/**
 * E274 — reconcile recovery route integration tests.
 *
 * Verifies the cron-secret auth gate + the missed-webhook repair path:
 * loads stored rows → fetches gateway truth → pure diff → writes the patch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// --- Mocks ------------------------------------------------------------------

const updates: Array<Record<string, unknown>> = []
const dbRows: Array<Record<string, unknown>> = []

vi.mock("@/lib/db", () => {
  const select = () => ({ from: () => ({ where: async () => dbRows }) })
  const update = () => ({
    set: (vals: Record<string, unknown>) => ({
      where: async () => {
        updates.push(vals)
        return []
      },
    }),
  })
  return { db: { select, update } }
})

vi.mock("@/lib/schema", () => ({
  subscriptionsTable: { provider: "provider", status: "status", providerSubId: "provider_sub_id" },
}))

vi.mock("drizzle-orm", () => ({
  and: (...a: unknown[]) => ({ __and: a }),
  eq: (...a: unknown[]) => ({ __eq: a }),
  inArray: (...a: unknown[]) => ({ __in: a }),
}))

const mockFetchGatewayStates = vi.fn()
vi.mock("@/lib/billing/providers/stripe", () => ({
  getStripeProvider: () => ({ fetchGatewayStates: mockFetchGatewayStates }),
}))

// --- Import SUT after mocks -------------------------------------------------

import { POST } from "./route"

function req(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/billing/reconcile", {
    method: "POST",
    headers,
  }) as unknown as import("next/server").NextRequest
}

beforeEach(() => {
  vi.clearAllMocks()
  updates.length = 0
  dbRows.length = 0
  process.env.CRON_SECRET = "s3cr3t"
})

afterEach(() => {
  delete process.env.CRON_SECRET
})

describe("POST /api/billing/reconcile — auth", () => {
  it("401s without a bearer token", async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)
  })

  it("401s with the wrong token", async () => {
    const res = await POST(req({ authorization: "Bearer wrong" }))
    expect(res.status).toBe(401)
  })

  it("fails closed when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET
    const res = await POST(req({ authorization: "Bearer anything" }))
    expect(res.status).toBe(401)
  })
})

describe("POST /api/billing/reconcile — repair", () => {
  it("returns zero counts when there are no live subscriptions", async () => {
    const res = await POST(req({ authorization: "Bearer s3cr3t" }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ ok: true, checked: 0, updated: 0 })
    expect(mockFetchGatewayStates).not.toHaveBeenCalled()
  })

  it("repairs a status drift left by a missed webhook", async () => {
    dbRows.push({
      providerSubId: "sub_stripe_1",
      status: "active",
      currentPeriodEnd: new Date(1_700_000_000 * 1000),
      cancelAt: null,
    })
    mockFetchGatewayStates.mockResolvedValue([
      {
        providerSubId: "sub_stripe_1",
        status: "past_due",
        currentPeriodEnd: 1_700_000_000,
        cancelAt: null,
      },
    ])

    const res = await POST(req({ authorization: "Bearer s3cr3t" }))
    const body = await res.json()

    expect(body).toMatchObject({ ok: true, checked: 1, updated: 1 })
    expect(mockFetchGatewayStates).toHaveBeenCalledWith(["sub_stripe_1"])
    // Wrote the repaired status back.
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({ status: "past_due" })
  })

  it("does not write when stored already matches the gateway", async () => {
    dbRows.push({
      providerSubId: "sub_stripe_2",
      status: "active",
      currentPeriodEnd: new Date(1_700_000_000 * 1000),
      cancelAt: null,
    })
    mockFetchGatewayStates.mockResolvedValue([
      {
        providerSubId: "sub_stripe_2",
        status: "active",
        currentPeriodEnd: 1_700_000_000,
        cancelAt: null,
      },
    ])

    const res = await POST(req({ authorization: "Bearer s3cr3t" }))
    const body = await res.json()
    expect(body).toMatchObject({ checked: 1, updated: 0 })
    expect(updates).toHaveLength(0)
  })
})
