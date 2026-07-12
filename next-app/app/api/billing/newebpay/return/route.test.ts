/**
 * E329 — 藍新 NewebPay notify route tests.
 *
 * Verifies the route wiring: verify → decode MerchantOrderNo → order lookup →
 * settleOrder (idempotent) → 200 ack; invalid TradeSha → 400. Idempotency itself
 * lives in settleOrder() (tested in lib/billing/orders); here we assert the route
 * hands a stable providerEventId + success flag to it and acks 200 on a duplicate.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { orderIdToMerchantOrderNo } from "@/lib/billing/providers/newebpay"

const ORDER_ID = "0f36e34d-9df1-4a3c-9a01-5a111111abcd"
const MERCHANT_ORDER_NO = orderIdToMerchantOrderNo(ORDER_ID)

// --- Mocks ------------------------------------------------------------------

const mockVerifyWebhook = vi.fn()
vi.mock("@/lib/billing/providers/newebpay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/billing/providers/newebpay")>()
  return {
    ...actual, // keep the real orderIdToMerchantOrderNo / merchantOrderNoToOrderId
    getNewebPayProvider: () => ({ verifyWebhook: mockVerifyWebhook }),
  }
})

const orderRows: Array<{ id: string }> = []
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => orderRows }) }),
    }),
  },
}))

vi.mock("@/lib/schema", () => ({
  ordersTable: { id: "id" },
}))

vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ __eq: a }),
}))

const mockSettleOrder = vi.fn()
vi.mock("@/lib/billing/orders", () => ({
  settleOrder: (...a: unknown[]) => mockSettleOrder(...a),
}))

// --- Import SUT after mocks -------------------------------------------------

import { POST } from "./route"

function req(body: string) {
  return new Request("http://localhost/api/billing/newebpay/return", {
    method: "POST",
    body,
  }) as unknown as import("next/server").NextRequest
}

function validPayload(status = "SUCCESS") {
  return {
    valid: true,
    eventType: "newebpay.mpg.notify",
    payload: {
      status,
      message: "授權成功",
      merchantOrderNo: MERCHANT_ORDER_NO,
      tradeNo: "24010112345678901",
      amount: 1200,
      result: {},
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  orderRows.length = 0
  mockSettleOrder.mockResolvedValue({ settled: true, duplicate: false, status: "paid" })
})

afterEach(() => {
  orderRows.length = 0
})

describe("POST /api/billing/newebpay/return", () => {
  it("400s on an invalid TradeSha", async () => {
    mockVerifyWebhook.mockResolvedValue({ valid: false, eventType: "", payload: null })
    const res = await POST(req("TradeInfo=x&TradeSha=bad"))
    expect(res.status).toBe(400)
    expect(mockSettleOrder).not.toHaveBeenCalled()
  })

  it("500s when the provider config throws (missing env) so NewebPay retries", async () => {
    mockVerifyWebhook.mockRejectedValue(new Error("NEWEBPAY_HASH_KEY is not set"))
    const res = await POST(req("TradeInfo=x&TradeSha=y"))
    expect(res.status).toBe(500)
  })

  it("settles a matching pending order and acks 200", async () => {
    mockVerifyWebhook.mockResolvedValue(validPayload())
    orderRows.push({ id: ORDER_ID })

    const res = await POST(req("TradeInfo=enc&TradeSha=sig"))
    expect(res.status).toBe(200)

    expect(mockSettleOrder).toHaveBeenCalledTimes(1)
    const arg = mockSettleOrder.mock.calls[0]![0] as Record<string, unknown>
    expect(arg).toMatchObject({
      provider: "newebpay",
      providerEventId: "newebpay:24010112345678901",
      orderId: ORDER_ID,
      providerOrderId: "24010112345678901",
      success: true,
    })
  })

  it("is idempotent at the ack layer — a duplicate delivery still 200s", async () => {
    mockVerifyWebhook.mockResolvedValue(validPayload())
    orderRows.push({ id: ORDER_ID })
    // settleOrder reports the second delivery as a duplicate no-op.
    mockSettleOrder
      .mockResolvedValueOnce({ settled: true, duplicate: false, status: "paid" })
      .mockResolvedValueOnce({ settled: false, duplicate: true, status: "skipped" })

    const first = await POST(req("TradeInfo=enc&TradeSha=sig"))
    const second = await POST(req("TradeInfo=enc&TradeSha=sig"))

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(mockSettleOrder).toHaveBeenCalledTimes(2)
    // Same idempotency key both times → settleOrder dedupes.
    const k1 = (mockSettleOrder.mock.calls[0]![0] as { providerEventId: string })
      .providerEventId
    const k2 = (mockSettleOrder.mock.calls[1]![0] as { providerEventId: string })
      .providerEventId
    expect(k1).toBe(k2)
  })

  it("passes success=false for a non-SUCCESS status", async () => {
    mockVerifyWebhook.mockResolvedValue(validPayload("FAIL"))
    orderRows.push({ id: ORDER_ID })

    await POST(req("TradeInfo=enc&TradeSha=sig"))
    const arg = mockSettleOrder.mock.calls[0]![0] as { success: boolean }
    expect(arg.success).toBe(false)
  })

  it("acks 200 without settling when no order matches the MerchantOrderNo", async () => {
    mockVerifyWebhook.mockResolvedValue(validPayload())
    // orderRows stays empty → lookup returns nothing.
    const res = await POST(req("TradeInfo=enc&TradeSha=sig"))
    expect(res.status).toBe(200)
    expect(mockSettleOrder).not.toHaveBeenCalled()
  })
})
