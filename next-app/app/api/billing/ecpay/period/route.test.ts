/**
 * E347 — ECPay PeriodReturnURL (per-cycle charge) route integration tests.
 *
 * Verifies the money-path: CheckMacValue gate, a successful cycle charge
 * extending currentPeriodEnd + recording payment_events, a FAILED cycle charge
 * transitioning the subscription to "past_due" (never mistaken for "active"),
 * idempotency via payment_events onConflictDoNothing keyed on Gwsr, and the
 * needs_renewal flag flipping once the remaining runway drops below threshold.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ecpayNextChargeDate } from "@/lib/billing/period-utils"

// --- State the mocks read/write --------------------------------------------

const state: {
  peInsertReturns: Array<{ id: string }> // payment_events insert result (empty = duplicate)
  subRows: Array<Record<string, unknown>> // subscription lookup result
  subUpdates: Array<Record<string, unknown>>
} = { peInsertReturns: [{ id: "pe_1" }], subRows: [], subUpdates: [] }

const PE = { __t: "payment_events", providerEventId: "provider_event_id" }
const SUB = { __t: "subscriptions", providerSubId: "provider_sub_id" }

vi.mock("@/lib/db", () => {
  const db = {
    select() {
      return { from: () => ({ where: () => ({ limit: async () => state.subRows }) }) }
    },
    insert(table: { __t: string }) {
      // Only payment_events is inserted in this route.
      void table
      return {
        values: () => ({
          onConflictDoNothing: () => ({
            returning: async () => state.peInsertReturns,
          }),
        }),
      }
    },
    update(table: { __t: string }) {
      if (table.__t === "subscriptions") {
        return {
          set: (vals: Record<string, unknown>) => ({
            where: async () => {
              state.subUpdates.push(vals)
              return []
            },
          }),
        }
      }
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

const mockVerifyWebhook = vi.fn()
vi.mock("@/lib/billing/providers/ecpay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/billing/providers/ecpay")>()
  return {
    ...actual, // keep the real EXEC_STATUS / DEFAULT_RENEWAL_THRESHOLD constants
    getEcpayProvider: () => ({ verifyWebhook: mockVerifyWebhook }),
  }
})

// --- Import SUT after mocks -------------------------------------------------

import { POST } from "./route"

function req(body: string) {
  return new Request("http://localhost/api/billing/ecpay/period", {
    method: "POST",
    body,
  }) as unknown as import("next/server").NextRequest
}

function periodParams(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    MerchantTradeNo: "SUB1000000001",
    RtnCode: "1",
    Gwsr: "9001",
    TotalSuccessTimes: "5",
    ExecTimes: "999",
    Amount: "299",
    ...overrides,
  }
}

function valid(payload: Record<string, string>) {
  return { valid: true, eventType: "ecpay.period.payment", payload }
}

const FROZEN_NOW = new Date("2026-08-23T00:00:00.000Z")

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(FROZEN_NOW)
  state.peInsertReturns = [{ id: "pe_1" }]
  state.subRows = []
  state.subUpdates = []
})

afterEach(() => {
  vi.useRealTimers()
})

describe("POST /api/billing/ecpay/period — signature gate", () => {
  it("rejects an invalid CheckMacValue with 400 and zero DB side effects", async () => {
    mockVerifyWebhook.mockResolvedValue({ valid: false, eventType: "", payload: null })
    const res = await POST(req("MerchantTradeNo=x&CheckMacValue=bad"))
    expect(res.status).toBe(400)
    expect(state.subUpdates).toHaveLength(0)
  })

  it("500s when the provider config throws (missing env) so ECPay retries", async () => {
    mockVerifyWebhook.mockRejectedValue(new Error("ECPAY_HASH_KEY is not set"))
    const res = await POST(req("MerchantTradeNo=x&CheckMacValue=y"))
    expect(res.status).toBe(500)
    expect(state.subUpdates).toHaveLength(0)
  })
})

describe("POST /api/billing/ecpay/period — successful cycle charge", () => {
  it("extends currentPeriodEnd, sets status active, and records the payment", async () => {
    state.subRows = [
      {
        providerSubId: "SUB1000000001",
        currentPeriodEnd: new Date("2026-07-23T00:00:00.000Z"),
        providerMeta: { period_type: "M", renewal_threshold: 3 },
      },
    ]
    mockVerifyWebhook.mockResolvedValue(valid(periodParams()))

    const res = await POST(req("body"))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("1|OK")

    expect(state.subUpdates).toHaveLength(1)
    const update = state.subUpdates[0]!
    expect(update.status).toBe("active")

    const expectedNext = ecpayNextChargeDate(FROZEN_NOW, "M", 1)
    expect((update.currentPeriodEnd as Date).getTime()).toBe(expectedNext.getTime())

    expect(update.providerMeta).toMatchObject({
      total_success_times: 5,
      exec_times: 999,
      exec_status: "1", // RUNNING — remaining (994) >= threshold (3)
      needs_renewal: false,
      last_period_amount: 299,
      last_period_gwsr: "9001",
    })
  })

  it("flags needs_renewal once remaining runway drops below the threshold", async () => {
    state.subRows = [
      {
        providerSubId: "SUB1000000001",
        currentPeriodEnd: new Date("2026-07-23T00:00:00.000Z"),
        providerMeta: { period_type: "M", renewal_threshold: 3 },
      },
    ]
    mockVerifyWebhook.mockResolvedValue(
      valid(periodParams({ TotalSuccessTimes: "997", ExecTimes: "999" })), // remaining = 2 < 3
    )

    await POST(req("body"))

    const update = state.subUpdates[0]!
    expect(update.providerMeta).toMatchObject({
      needs_renewal: true,
      exec_status: "2", // COMPLETED
    })
  })
})

describe("POST /api/billing/ecpay/period — failed cycle charge", () => {
  it("transitions the subscription to past_due, never active, and does not advance the period", async () => {
    const originalPeriodEnd = new Date("2026-07-23T00:00:00.000Z")
    state.subRows = [
      {
        providerSubId: "SUB1000000001",
        currentPeriodEnd: originalPeriodEnd,
        providerMeta: { period_type: "M", renewal_threshold: 3 },
      },
    ]
    mockVerifyWebhook.mockResolvedValue(
      valid(periodParams({ RtnCode: "10100248" })), // declined
    )

    const res = await POST(req("body"))
    expect(res.status).toBe(200)

    expect(state.subUpdates).toHaveLength(1)
    const update = state.subUpdates[0]!
    expect(update.status).toBe("past_due")
    expect(update.status).not.toBe("active")
    // Failed charge must NOT advance the billing period.
    expect((update.currentPeriodEnd as Date).getTime()).toBe(originalPeriodEnd.getTime())
  })
})

describe("POST /api/billing/ecpay/period — idempotency", () => {
  it("replaying the same cycle notification (same Gwsr) does not double-settle", async () => {
    state.subRows = [
      {
        providerSubId: "SUB1000000001",
        currentPeriodEnd: new Date("2026-07-23T00:00:00.000Z"),
        providerMeta: { period_type: "M", renewal_threshold: 3 },
      },
    ]
    mockVerifyWebhook.mockResolvedValue(valid(periodParams()))

    const first = await POST(req("body"))
    expect(first.status).toBe(200)
    expect(state.subUpdates).toHaveLength(1)

    // Same Gwsr redelivered → onConflictDoNothing returns [] the second time.
    state.peInsertReturns = []
    const second = await POST(req("body"))
    expect(second.status).toBe(200)

    // No second settlement — still exactly one update.
    expect(state.subUpdates).toHaveLength(1)
  })
})

describe("POST /api/billing/ecpay/period — no matching subscription", () => {
  it("acks 200 without updating anything when no subscription matches the trade no", async () => {
    state.subRows = [] // no matching row
    mockVerifyWebhook.mockResolvedValue(valid(periodParams()))

    const res = await POST(req("body"))
    expect(res.status).toBe(200)
    expect(state.subUpdates).toHaveLength(0)
  })
})
