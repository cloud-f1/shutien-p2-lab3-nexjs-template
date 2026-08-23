/**
 * E347 — ECPay ReturnURL (first authorization) route integration tests.
 *
 * Verifies the money-path: CheckMacValue gate, the one-time-order delegation
 * branch (CustomField3 = orders.id → settleOrder), the subscription-creation
 * branch (CustomField3 = plans.id UUID → subscriptionsTable upsert), idempotency
 * via payment_events onConflictDoNothing, and that a non-success RtnCode is
 * never mistaken for a successful authorization.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// --- State the mocks read/write --------------------------------------------

const state: {
  peInsertReturns: Array<{ id: string }> // payment_events insert result (empty = duplicate)
  subscriptionUpserts: Array<{ values: Record<string, unknown>; conflict?: unknown }>
  subscriptionUpdates: Array<Record<string, unknown>>
  orderRows: Array<{ id: string }>
} = { peInsertReturns: [{ id: "pe_1" }], subscriptionUpserts: [], subscriptionUpdates: [], orderRows: [] }

// Table markers so the mocked db can dispatch by identity.
const PE = { __t: "payment_events", providerEventId: "provider_event_id" }
const SUB = { __t: "subscriptions", providerSubId: "provider_sub_id" }
const ORDERS = { __t: "orders", id: "id" }

vi.mock("@/lib/db", () => {
  const db = {
    select(cols: unknown) {
      void cols
      return {
        from: () => ({
          where: () => ({ limit: async () => state.orderRows }),
        }),
      }
    },
    insert(table: { __t: string }) {
      if (table.__t === "payment_events") {
        return {
          values: () => ({
            onConflictDoNothing: () => ({
              returning: async () => state.peInsertReturns,
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
    update(table: { __t: string }) {
      if (table.__t === "subscriptions") {
        return {
          set: (vals: Record<string, unknown>) => ({
            where: async () => {
              state.subscriptionUpdates.push(vals)
              return []
            },
          }),
        }
      }
      // payment_events "mark processed" update — irrelevant to assertions.
      return { set: () => ({ where: async () => [] }) }
    },
  }
  return { db }
})

vi.mock("@/lib/schema", () => ({
  paymentEventsTable: PE,
  subscriptionsTable: SUB,
  ordersTable: ORDERS,
}))

vi.mock("drizzle-orm", () => ({ eq: (...a: unknown[]) => ({ __eq: a }) }))

const mockCoercePlanUuid = vi.fn()
vi.mock("@/lib/billing/plans", () => ({
  coercePlanUuid: (...a: unknown[]) => mockCoercePlanUuid(...a),
}))

const mockSettleOrder = vi.fn()
vi.mock("@/lib/billing/orders", () => ({
  settleOrder: (...a: unknown[]) => mockSettleOrder(...a),
}))

const mockVerifyWebhook = vi.fn()
vi.mock("@/lib/billing/providers/ecpay", () => ({
  getEcpayProvider: () => ({ verifyWebhook: mockVerifyWebhook }),
}))

// --- Import SUT after mocks -------------------------------------------------

import { POST } from "./route"

function req(body: string) {
  return new Request("http://localhost/api/billing/ecpay/return", {
    method: "POST",
    body,
  }) as unknown as import("next/server").NextRequest
}

const PLAN_UUID = "11111111-1111-4111-8111-111111111111"
const ORDER_UUID = "22222222-2222-4222-8222-222222222222"

function subParams(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    MerchantTradeNo: "SUB1000000001",
    TradeNo: "24010112345678901",
    RtnCode: "1",
    TradeAmt: "299",
    CustomField1: "user_1", // userId
    CustomField2: "month:299:Pro Plan", // interval:amount:description
    CustomField3: PLAN_UUID, // plans.id UUID (E274)
    ...overrides,
  }
}

function valid(payload: Record<string, string>) {
  return { valid: true, eventType: "ecpay.return.payment", payload }
}

beforeEach(() => {
  vi.clearAllMocks()
  state.peInsertReturns = [{ id: "pe_1" }]
  state.subscriptionUpserts = []
  state.subscriptionUpdates = []
  state.orderRows = []
  mockCoercePlanUuid.mockResolvedValue(PLAN_UUID)
})

afterEach(() => {
  state.orderRows = []
})

describe("POST /api/billing/ecpay/return — signature gate", () => {
  it("rejects an invalid CheckMacValue with 400 and zero DB side effects", async () => {
    mockVerifyWebhook.mockResolvedValue({ valid: false, eventType: "", payload: null })
    const res = await POST(req("MerchantTradeNo=x&CheckMacValue=bad"))
    expect(res.status).toBe(400)
    expect(state.subscriptionUpserts).toHaveLength(0)
    expect(state.subscriptionUpdates).toHaveLength(0)
    expect(mockSettleOrder).not.toHaveBeenCalled()
    expect(mockCoercePlanUuid).not.toHaveBeenCalled()
  })

  it("rejects a missing CheckMacValue with 400 and zero DB side effects", async () => {
    // The provider itself reports invalid when CheckMacValue is absent from the body.
    mockVerifyWebhook.mockResolvedValue({ valid: false, eventType: "", payload: null })
    const res = await POST(req("MerchantTradeNo=x"))
    expect(res.status).toBe(400)
    expect(state.subscriptionUpserts).toHaveLength(0)
  })

  it("500s when the provider config throws (missing env) so ECPay retries", async () => {
    mockVerifyWebhook.mockRejectedValue(new Error("ECPAY_HASH_KEY is not set"))
    const res = await POST(req("MerchantTradeNo=x&CheckMacValue=y"))
    expect(res.status).toBe(500)
    expect(state.subscriptionUpserts).toHaveLength(0)
  })
})

describe("POST /api/billing/ecpay/return — one-time order delegation (E327)", () => {
  it("delegates to settleOrder when CustomField3 matches an existing order", async () => {
    state.orderRows = [{ id: ORDER_UUID }]
    mockVerifyWebhook.mockResolvedValue(
      valid(subParams({ CustomField3: ORDER_UUID, RtnCode: "1" })),
    )

    const res = await POST(req("body"))
    expect(res.status).toBe(200)

    expect(mockSettleOrder).toHaveBeenCalledTimes(1)
    expect(mockSettleOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "ecpay",
        providerEventId: "order-return:SUB1000000001",
        orderId: ORDER_UUID,
        providerOrderId: "24010112345678901",
        success: true,
      }),
    )
    // The subscription path must NOT also run.
    expect(state.subscriptionUpserts).toHaveLength(0)
    expect(mockCoercePlanUuid).not.toHaveBeenCalled()
  })

  it("passes success=false to settleOrder for a failed order-return RtnCode", async () => {
    state.orderRows = [{ id: ORDER_UUID }]
    mockVerifyWebhook.mockResolvedValue(
      valid(subParams({ CustomField3: ORDER_UUID, RtnCode: "10200095" })),
    )

    await POST(req("body"))
    expect(mockSettleOrder).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    )
  })
})

describe("POST /api/billing/ecpay/return — subscription creation (first auth)", () => {
  it("on RtnCode=1, resolves the plan UUID and upserts an active subscription", async () => {
    mockVerifyWebhook.mockResolvedValue(valid(subParams()))

    const res = await POST(req("body"))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("1|OK")

    expect(mockCoercePlanUuid).toHaveBeenCalledWith(PLAN_UUID)
    expect(state.subscriptionUpserts).toHaveLength(1)
    const upsert = state.subscriptionUpserts[0]!
    expect(upsert.values).toMatchObject({
      userId: "user_1",
      planId: PLAN_UUID, // the coerced UUID, never the raw CustomField2 encoding
      provider: "ecpay",
      providerSubId: "SUB1000000001",
      status: "active",
    })
    expect((upsert.values.currentPeriodEnd as Date)).toBeInstanceOf(Date)
    expect(upsert.values.providerMeta).toMatchObject({
      merchant_trade_no: "SUB1000000001",
      ecpay_trade_no: "24010112345678901",
      total_success_times: 1,
      exec_status: "1",
      period_type: "M",
      first_auth_amount: 299,
    })
    // Never touched the "incomplete" failure path.
    expect(state.subscriptionUpdates).toHaveLength(0)
  })

  it("is idempotent — replaying the same first-auth notification twice upserts once", async () => {
    mockVerifyWebhook.mockResolvedValue(valid(subParams()))

    const first = await POST(req("body"))
    expect(first.status).toBe(200)
    expect(state.subscriptionUpserts).toHaveLength(1)

    // Second delivery of the SAME provider_event_id → onConflictDoNothing returns [].
    state.peInsertReturns = []
    const second = await POST(req("body"))
    expect(second.status).toBe(200)

    // No second side effect — still exactly one upsert.
    expect(state.subscriptionUpserts).toHaveLength(1)
  })

  it("does NOT mistake a failure/cancel RtnCode for success — marks the subscription incomplete instead", async () => {
    mockVerifyWebhook.mockResolvedValue(valid(subParams({ RtnCode: "10200095" })))

    const res = await POST(req("body"))
    expect(res.status).toBe(200)

    // No subscription was created/activated.
    expect(state.subscriptionUpserts).toHaveLength(0)
    expect(mockCoercePlanUuid).not.toHaveBeenCalled()
    // Instead, any existing subscription row for this trade no is marked incomplete.
    expect(state.subscriptionUpdates).toHaveLength(1)
    expect(state.subscriptionUpdates[0]).toMatchObject({ status: "incomplete" })
  })
})
