/**
 * E274 — ECPay renewal scheduler route integration tests.
 *
 * Verifies the cron-secret gate + the renewal sweep: queries each active ECPay
 * subscription, flags those whose runway is short, and persists the totals.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
}))

const mockQueryAndCheckRenewal = vi.fn()
vi.mock("@/lib/billing/providers/ecpay", () => ({
  getEcpayProvider: () => ({ queryAndCheckRenewal: mockQueryAndCheckRenewal }),
}))

import { POST } from "./route"

function req(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/billing/ecpay/renew", {
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

describe("POST /api/billing/ecpay/renew — auth", () => {
  it("401s without a token", async () => {
    expect((await POST(req())).status).toBe(401)
  })

  it("fails closed when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET
    expect((await POST(req({ authorization: "Bearer x" }))).status).toBe(401)
  })
})

describe("POST /api/billing/ecpay/renew — sweep", () => {
  it("returns zero counts with no active ECPay subscriptions", async () => {
    const res = await POST(req({ authorization: "Bearer s3cr3t" }))
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, checked: 0, flagged: 0 })
    expect(mockQueryAndCheckRenewal).not.toHaveBeenCalled()
  })

  it("flags a subscription whose runway is short and persists the totals", async () => {
    dbRows.push({
      providerSubId: "SUB123",
      providerMeta: { period_type: "M", renewal_threshold: 3 },
    })
    mockQueryAndCheckRenewal.mockResolvedValue({
      execStatus: "2",
      execTimes: 999,
      totalSuccessTimes: 998,
      remaining: 1,
      needsRenewal: true,
    })

    const res = await POST(req({ authorization: "Bearer s3cr3t" }))
    const body = await res.json()

    expect(mockQueryAndCheckRenewal).toHaveBeenCalledWith("SUB123")
    expect(body).toMatchObject({ ok: true, checked: 1, flagged: 1 })
    expect(updates).toHaveLength(1)
    expect((updates[0]!.providerMeta as Record<string, unknown>).needs_renewal).toBe(true)
    expect((updates[0]!.providerMeta as Record<string, unknown>).total_success_times).toBe(998)
  })

  it("does not flag a healthy subscription", async () => {
    dbRows.push({ providerSubId: "SUB999", providerMeta: { period_type: "M" } })
    mockQueryAndCheckRenewal.mockResolvedValue({
      execStatus: "1",
      execTimes: 999,
      totalSuccessTimes: 10,
      remaining: 989,
      needsRenewal: false,
    })

    const res = await POST(req({ authorization: "Bearer s3cr3t" }))
    const body = await res.json()
    expect(body).toMatchObject({ checked: 1, flagged: 0 })
  })
})
