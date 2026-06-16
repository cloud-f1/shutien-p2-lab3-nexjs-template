/**
 * E274 — Stripe webhook route integration tests.
 *
 * Verifies the money-path: signature gate, idempotency via onConflictDoNothing
 * (duplicate event id → skipped), and checkout.session.completed writing the
 * coerced plans.id UUID + currentPeriodEnd into subscriptions (onConflictDoUpdate).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// --- State the mocks read/write --------------------------------------------

const state: {
  insertReturns: Array<{ id: string }> // payment_events insert result (empty = duplicate)
  subscriptionUpserts: Array<{ values: Record<string, unknown>; conflict?: unknown }>
} = { insertReturns: [{ id: "pe_1" }], subscriptionUpserts: [] }

// payment_events table marker vs subscriptions table marker
const PE = { __t: "payment_events", providerEventId: "provider_event_id" }
const SUB = { __t: "subscriptions", providerSubId: "provider_sub_id" }

vi.mock("@/lib/db", () => {
  const db = {
    insert(table: { __t: string }) {
      if (table.__t === "payment_events") {
        return {
          values: () => ({
            onConflictDoNothing: () => ({
              returning: async () => state.insertReturns,
            }),
          }),
        }
      }
      // subscriptions insert → onConflictDoUpdate (upsert)
      return {
        values: (values: Record<string, unknown>) => ({
          onConflictDoUpdate: async (conflict: unknown) => {
            state.subscriptionUpserts.push({ values, conflict })
            return []
          },
        }),
      }
    },
    update() {
      return { set: () => ({ where: async () => [] }) }
    },
  }
  return { db }
})

vi.mock("@/lib/schema", () => ({
  paymentEventsTable: PE,
  subscriptionsTable: SUB,
}))

vi.mock("drizzle-orm", () => ({ eq: (...a: unknown[]) => ({ __eq: a }) }))

// Plan resolver — coerce metadata.planId → real UUID
const mockCoercePlanUuid = vi.fn()
vi.mock("@/lib/billing/plans", () => ({
  coercePlanUuid: (...a: unknown[]) => mockCoercePlanUuid(...a),
}))

// Stripe provider verifyWebhook + the raw Stripe client used for retrieve()
const mockVerifyWebhook = vi.fn()
vi.mock("@/lib/billing/providers/stripe", () => ({
  getStripeProvider: () => ({ verifyWebhook: mockVerifyWebhook }),
}))

const mockRetrieve = vi.fn()
vi.mock("stripe", () => {
  function MockStripe() {
    return { subscriptions: { retrieve: mockRetrieve } }
  }
  return { default: MockStripe }
})

// --- Import SUT after mocks -------------------------------------------------

import { POST } from "./route"

function req(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/billing/stripe/webhook", {
    method: "POST",
    headers,
    body,
  }) as unknown as import("next/server").NextRequest
}

beforeEach(() => {
  vi.clearAllMocks()
  state.insertReturns = [{ id: "pe_1" }]
  state.subscriptionUpserts = []
  process.env.STRIPE_SECRET_KEY = "sk_test_x"
})

afterEach(() => {
  delete process.env.STRIPE_SECRET_KEY
})

describe("POST /api/billing/stripe/webhook", () => {
  it("400s when the stripe-signature header is missing", async () => {
    const res = await POST(req("{}"))
    expect(res.status).toBe(400)
  })

  it("400s on an invalid signature", async () => {
    mockVerifyWebhook.mockResolvedValue({ valid: false, eventType: "", payload: null })
    const res = await POST(req("{}", { "stripe-signature": "bad" }))
    expect(res.status).toBe(400)
  })

  it("skips a duplicate event (onConflictDoNothing returns empty)", async () => {
    state.insertReturns = [] // duplicate event id
    mockVerifyWebhook.mockResolvedValue({
      valid: true,
      eventType: "checkout.session.completed",
      payload: {
        id: "evt_dup",
        type: "checkout.session.completed",
        data: { object: {} },
      },
    })

    const res = await POST(req('{"id":"evt_dup"}', { "stripe-signature": "ok" }))
    const body = await res.json()
    expect(body).toMatchObject({ received: true, skipped: true })
    // Did NOT touch subscriptions.
    expect(state.subscriptionUpserts).toHaveLength(0)
  })

  it("writes the coerced plans.id UUID + currentPeriodEnd on checkout.session.completed", async () => {
    mockCoercePlanUuid.mockResolvedValue("uuid-plan-1")
    mockRetrieve.mockResolvedValue({
      id: "sub_stripe_1",
      status: "active",
      cancel_at: null,
      cancel_at_period_end: false,
      customer: "cus_1",
      items: { data: [{ current_period_end: 1_800_000_000 }] },
    })
    mockVerifyWebhook.mockResolvedValue({
      valid: true,
      eventType: "checkout.session.completed",
      payload: {
        id: "evt_1",
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "subscription",
            subscription: "sub_stripe_1",
            metadata: { userId: "user_1", planId: "uuid-plan-1" },
          },
        },
      },
    })

    const res = await POST(req('{"id":"evt_1"}', { "stripe-signature": "ok" }))
    const body = await res.json()
    expect(body).toMatchObject({ received: true })

    expect(mockCoercePlanUuid).toHaveBeenCalledWith("uuid-plan-1")
    expect(state.subscriptionUpserts).toHaveLength(1)
    const upsert = state.subscriptionUpserts[0]!
    // FK fix: planId written is the UUID, never the providerPriceId.
    expect(upsert.values.planId).toBe("uuid-plan-1")
    // currentPeriodEnd populated from the subscription item epoch.
    expect((upsert.values.currentPeriodEnd as Date).getTime()).toBe(1_800_000_000 * 1000)
  })

  it("skips the upsert when the plan UUID cannot be resolved (FK safety)", async () => {
    mockCoercePlanUuid.mockResolvedValue(null)
    mockRetrieve.mockResolvedValue({
      id: "sub_stripe_2",
      status: "active",
      cancel_at: null,
      cancel_at_period_end: false,
      customer: "cus_2",
      items: { data: [] },
    })
    mockVerifyWebhook.mockResolvedValue({
      valid: true,
      eventType: "checkout.session.completed",
      payload: {
        id: "evt_2",
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "subscription",
            subscription: "sub_stripe_2",
            metadata: { userId: "user_2", planId: "price_unknown" },
          },
        },
      },
    })

    const res = await POST(req('{"id":"evt_2"}', { "stripe-signature": "ok" }))
    expect(res.status).toBe(200)
    // No upsert — would have violated the FK.
    expect(state.subscriptionUpserts).toHaveLength(0)
  })
})
