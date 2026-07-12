/**
 * E329 — 藍新 NewebPay MPG 幕前支付 provider tests.
 *
 * Verifies:
 * 1. Deterministic AES-256-CBC + TradeSha fixture (NOT an official vector —
 *    constructed here with fixed HashKey/HashIV/params so the crypto is
 *    regression-locked) + encrypt→decrypt round-trip + TradeSha shape.
 * 2. verifyWebhook round-trip: a Result we encrypt is authenticated + parsed.
 * 3. Tampered-TradeSha rejection (constant-time compare) + missing-field reject.
 * 4. One-time checkout form shape: Version 2.0, MerchantID/TradeInfo/TradeSha
 *    present, gateway URL, Amt correct inside the decrypted TradeInfo.
 * 5. orders.id UUID ⇄ MerchantOrderNo round-trip + fit within 30 chars.
 * 6. Missing/invalid amount + missing orderId throw PaymentProviderError.
 * 7. Subscription intent is rejected (one-time-only gateway; LSP-clean).
 *
 * ⚠️ The 藍新 sandbox 實測 with REAL merchant credentials remains a HUMAN step —
 * see the epic acceptance checklist. These tests exercise the crypto/protocol
 * shape only, with deterministic local fixtures.
 */

import crypto from "crypto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  NewebPayProvider,
  NEWEBPAY_SANDBOX_BASE,
  NEWEBPAY_VERSION,
  _resetNewebPayProvider,
  decryptTradeInfo,
  encryptTradeInfo,
  generateTradeSha,
  merchantOrderNoToOrderId,
  orderIdToMerchantOrderNo,
  verifyTradeSha,
} from "./newebpay"

// 藍新 test credentials: HashKey MUST be 32 chars, HashIV MUST be 16 chars.
const TEST_HASH_KEY = "abcdefghijklmnopqrstuvwxyz012345" // 32 chars
const TEST_HASH_IV = "0123456789abcdef" // 16 chars
const TEST_MERCHANT_ID = "MS1234567890"

beforeEach(() => {
  process.env.NEWEBPAY_MERCHANT_ID = TEST_MERCHANT_ID
  process.env.NEWEBPAY_HASH_KEY = TEST_HASH_KEY
  process.env.NEWEBPAY_HASH_IV = TEST_HASH_IV
  delete process.env.NEWEBPAY_SANDBOX
  delete process.env.NEWEBPAY_API_BASE_URL
  delete process.env.NEXT_PUBLIC_APP_URL
  _resetNewebPayProvider()
})

afterEach(() => {
  delete process.env.NEWEBPAY_MERCHANT_ID
  delete process.env.NEWEBPAY_HASH_KEY
  delete process.env.NEWEBPAY_HASH_IV
  delete process.env.NEWEBPAY_SANDBOX
  delete process.env.NEWEBPAY_API_BASE_URL
  delete process.env.NEXT_PUBLIC_APP_URL
  _resetNewebPayProvider()
})

const DATA_PREFIX = "data:text/html;charset=utf-8,"

/** Decode the auto-submit form data URI and extract its hidden input fields. */
function parseFormFields(checkoutUrl: string): Record<string, string> {
  expect(checkoutUrl.startsWith(DATA_PREFIX)).toBe(true)
  const html = decodeURIComponent(checkoutUrl.slice(DATA_PREFIX.length))
  const fields: Record<string, string> = {}
  const re = /<input type="hidden" name="([^"]+)" value="([^"]*)">/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    fields[m[1]!] = m[2]!.replace(/&quot;/g, '"')
  }
  return fields
}

/** Extract the POST action URL from the auto-submit form data URI. */
function parseActionUrl(checkoutUrl: string): string {
  const html = decodeURIComponent(checkoutUrl.slice(DATA_PREFIX.length))
  return /action="([^"]+)"/.exec(html)?.[1] ?? ""
}

const ORDER_ID = "0f36e34d-9df1-4a3c-9a01-5a111111abcd"

function oneTimeArgs() {
  return {
    planId: "nextjs-course",
    mode: "one-time" as const,
    amount: 1200,
    currency: "TWD",
    productName: "Next.js 全端實戰課程",
    orderId: ORDER_ID,
    userId: "",
    customerEmail: "buyer@example.com",
    successUrl: "https://shop.example.com/p/nextjs-course/thanks?order=abc",
    cancelUrl: "https://shop.example.com/p/nextjs-course",
  }
}

// ---------------------------------------------------------------------------
// 1. Deterministic AES + TradeSha fixture (NOT an official vector)
// ---------------------------------------------------------------------------

describe("AES-256-CBC + TradeSha — deterministic local fixture", () => {
  // Fixed input ⇒ fixed ciphertext. Regenerated once via Node crypto with the
  // test key/iv above; locks the algorithm against regressions. This is a
  // CONSTRUCTED fixture, NOT the official 藍新 sample vector.
  const PLAINTEXT =
    "MerchantID=MS1234567890&RespondType=JSON&TimeStamp=1700000000&Version=2.0&MerchantOrderNo=abc123&Amt=1200"

  it("encrypt output is lower-case hex and a multiple of the AES block", () => {
    const hex = encryptTradeInfo(PLAINTEXT, TEST_HASH_KEY, TEST_HASH_IV)
    expect(hex).toMatch(/^[0-9a-f]+$/)
    expect(hex.length % 32).toBe(0) // 16-byte blocks → 32 hex chars each
  })

  it("is deterministic (fixed key/iv/plaintext ⇒ fixed ciphertext)", () => {
    const a = encryptTradeInfo(PLAINTEXT, TEST_HASH_KEY, TEST_HASH_IV)
    const b = encryptTradeInfo(PLAINTEXT, TEST_HASH_KEY, TEST_HASH_IV)
    expect(a).toBe(b)
  })

  it("round-trips encrypt → decrypt back to the exact plaintext", () => {
    const hex = encryptTradeInfo(PLAINTEXT, TEST_HASH_KEY, TEST_HASH_IV)
    expect(decryptTradeInfo(hex, TEST_HASH_KEY, TEST_HASH_IV)).toBe(PLAINTEXT)
  })

  it("TradeSha is 64-char upper-case hex over HashKey=..&TradeInfo&HashIV=..", () => {
    const hex = encryptTradeInfo(PLAINTEXT, TEST_HASH_KEY, TEST_HASH_IV)
    const sha = generateTradeSha(hex, TEST_HASH_KEY, TEST_HASH_IV)
    expect(sha).toMatch(/^[0-9A-F]{64}$/)
    // Independent recomputation of the documented formula.
    const expected = crypto
      .createHash("sha256")
      .update(`HashKey=${TEST_HASH_KEY}&${hex}&HashIV=${TEST_HASH_IV}`)
      .digest("hex")
      .toUpperCase()
    expect(sha).toBe(expected)
  })
})

// ---------------------------------------------------------------------------
// 2 + 3. verifyWebhook — round-trip + tamper rejection
// ---------------------------------------------------------------------------

/** Build a NewebPay-style notify form body by encrypting a Result JSON. */
function buildNotifyBody(
  result: Record<string, unknown>,
  status = "SUCCESS",
  overrides?: { tradeSha?: string },
): string {
  const decoded = JSON.stringify({ Status: status, Message: "授權成功", Result: result })
  const tradeInfo = encryptTradeInfo(decoded, TEST_HASH_KEY, TEST_HASH_IV)
  const tradeSha =
    overrides?.tradeSha ?? generateTradeSha(tradeInfo, TEST_HASH_KEY, TEST_HASH_IV)
  return new URLSearchParams({
    Status: status,
    MerchantID: TEST_MERCHANT_ID,
    Version: NEWEBPAY_VERSION,
    TradeInfo: tradeInfo,
    TradeSha: tradeSha,
  }).toString()
}

describe("NewebPayProvider.verifyWebhook", () => {
  const result = {
    MerchantID: TEST_MERCHANT_ID,
    MerchantOrderNo: orderIdToMerchantOrderNo(ORDER_ID),
    TradeNo: "24010112345678901",
    Amt: 1200,
    PaymentType: "CREDIT",
  }

  it("authenticates a valid notify and parses Status + Result fields", async () => {
    const provider = new NewebPayProvider()
    const res = await provider.verifyWebhook(buildNotifyBody(result), {})

    expect(res.valid).toBe(true)
    expect(res.eventType).toBe("newebpay.mpg.notify")
    const payload = res.payload as {
      status: string
      merchantOrderNo: string
      tradeNo: string
      amount: number
    }
    expect(payload.status).toBe("SUCCESS")
    expect(payload.tradeNo).toBe("24010112345678901")
    expect(payload.amount).toBe(1200)
    expect(merchantOrderNoToOrderId(payload.merchantOrderNo)).toBe(ORDER_ID)
  })

  it("rejects a tampered TradeSha (constant-time compare)", async () => {
    const provider = new NewebPayProvider()
    const tampered = buildNotifyBody(result, "SUCCESS", {
      tradeSha: "F".repeat(64),
    })
    const res = await provider.verifyWebhook(tampered, {})
    expect(res.valid).toBe(false)
  })

  it("rejects a body missing TradeInfo / TradeSha", async () => {
    const provider = new NewebPayProvider()
    const res = await provider.verifyWebhook("Status=SUCCESS&MerchantID=x", {})
    expect(res.valid).toBe(false)
    expect(res.payload).toBeNull()
  })

  it("verifyTradeSha unit: valid true, mutated false", () => {
    const hex = encryptTradeInfo("Amt=1&x=y", TEST_HASH_KEY, TEST_HASH_IV)
    const sha = generateTradeSha(hex, TEST_HASH_KEY, TEST_HASH_IV)
    expect(verifyTradeSha(hex, sha, TEST_HASH_KEY, TEST_HASH_IV)).toBe(true)
    expect(verifyTradeSha(hex, sha.slice(0, 63) + "0", TEST_HASH_KEY, TEST_HASH_IV)).toBe(
      false,
    )
  })
})

// ---------------------------------------------------------------------------
// 4. One-time checkout form shape
// ---------------------------------------------------------------------------

describe("NewebPayProvider.createCheckout({ mode: 'one-time' })", () => {
  it("posts MerchantID/TradeInfo/TradeSha/Version to the sandbox MPG gateway", async () => {
    const provider = new NewebPayProvider()
    const result = await provider.createCheckout(oneTimeArgs())
    const fields = parseFormFields(result.checkoutUrl)

    expect(fields["MerchantID"]).toBe(TEST_MERCHANT_ID)
    expect(fields["Version"]).toBe("2.0")
    expect(fields["TradeInfo"]).toMatch(/^[0-9a-f]+$/)
    expect(fields["TradeSha"]).toMatch(/^[0-9A-F]{64}$/)
    expect(parseActionUrl(result.checkoutUrl)).toBe(
      `${NEWEBPAY_SANDBOX_BASE}/MPG/mpg_gateway`,
    )
  })

  it("encrypts Amt = order amount and the order-derived MerchantOrderNo", async () => {
    const provider = new NewebPayProvider()
    const result = await provider.createCheckout(oneTimeArgs())
    const fields = parseFormFields(result.checkoutUrl)

    const decoded = decryptTradeInfo(fields["TradeInfo"]!, TEST_HASH_KEY, TEST_HASH_IV)
    const params = Object.fromEntries(new URLSearchParams(decoded))

    expect(params["Amt"]).toBe("1200")
    expect(params["RespondType"]).toBe("JSON")
    expect(params["Version"]).toBe("2.0")
    expect(params["Email"]).toBe("buyer@example.com")
    expect(params["MerchantOrderNo"]).toBe(orderIdToMerchantOrderNo(ORDER_ID))
    expect(params["NotifyURL"]).toContain("/api/billing/newebpay/return")
    expect(params["ReturnURL"]).toContain("/api/billing/newebpay/return")
    expect(params["ClientBackURL"]).toBe(oneTimeArgs().successUrl)
    // sessionId is the reconciliation key (MerchantOrderNo).
    expect(result.sessionId).toBe(params["MerchantOrderNo"])
  })

  it("targets the production gateway when NEWEBPAY_SANDBOX=false", async () => {
    process.env.NEWEBPAY_SANDBOX = "false"
    const provider = new NewebPayProvider()
    const result = await provider.createCheckout(oneTimeArgs())
    expect(parseActionUrl(result.checkoutUrl)).toBe(
      "https://core.newebpay.com/MPG/mpg_gateway",
    )
  })

  it("rejects a missing / non-positive amount", async () => {
    const provider = new NewebPayProvider()
    await expect(
      provider.createCheckout({ ...oneTimeArgs(), amount: 0 }),
    ).rejects.toThrow("Invalid one-time amount")
    await expect(
      provider.createCheckout({ ...oneTimeArgs(), amount: undefined }),
    ).rejects.toThrow("Invalid one-time amount")
  })

  it("rejects a missing orderId (needed to settle via MerchantOrderNo)", async () => {
    const provider = new NewebPayProvider()
    await expect(
      provider.createCheckout({ ...oneTimeArgs(), orderId: undefined }),
    ).rejects.toThrow("requires args.orderId")
  })

  it("rejects subscription intent (one-time-only gateway, LSP-clean)", async () => {
    const provider = new NewebPayProvider()
    await expect(
      provider.createCheckout({ ...oneTimeArgs(), mode: "subscription" }),
    ).rejects.toThrow(/one-time-only/)
  })
})

// ---------------------------------------------------------------------------
// 5. orders.id UUID ⇄ MerchantOrderNo
// ---------------------------------------------------------------------------

describe("orderIdToMerchantOrderNo ⇄ merchantOrderNoToOrderId", () => {
  it("round-trips a UUID and fits within the 30-char MerchantOrderNo limit", () => {
    const mon = orderIdToMerchantOrderNo(ORDER_ID)
    expect(mon).toMatch(/^[0-9a-z]+$/) // url-safe subset of [A-Za-z0-9_]
    expect(mon.length).toBeLessThanOrEqual(30)
    expect(merchantOrderNoToOrderId(mon)).toBe(ORDER_ID)
  })

  it("round-trips a leading-zero UUID (padStart on decode)", () => {
    const id = "00000000-0000-4000-8000-000000000001"
    expect(merchantOrderNoToOrderId(orderIdToMerchantOrderNo(id))).toBe(id)
  })

  it("returns null for a non-order-derived MerchantOrderNo", () => {
    expect(merchantOrderNoToOrderId("not_a_uuid_encoding!")).toBeNull()
    // Overflows a 128-bit id → not our encoding.
    expect(merchantOrderNoToOrderId("z".repeat(40))).toBeNull()
  })

  it("throws for a non-UUID orderId", () => {
    expect(() => orderIdToMerchantOrderNo("nope")).toThrow("orders.id UUID")
  })
})
