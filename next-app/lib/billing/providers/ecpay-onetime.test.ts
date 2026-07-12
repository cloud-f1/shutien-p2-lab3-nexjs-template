/**
 * E327 — EcpayProvider one-time checkout tests (the QA gap: createCheckout
 * output shape for mode "one-time" was previously untested).
 *
 * Verifies:
 * 1. `mode: "one-time"` builds a PLAIN AioCheckOut order — TotalAmount equals
 *    the order amount and NO 定期定額 fields (PeriodAmount / PeriodType /
 *    Frequency / ExecTimes / PeriodReturnURL) are present.
 * 2. CheckMacValue on the one-time form is valid.
 * 3. orders.id rides CustomField3 for the settlement route.
 * 4. REGRESSION — the subscription path (no mode) is unchanged: the form still
 *    carries the 定期定額 fields exactly as before.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { EcpayProvider, _resetEcpayProvider, verifyCheckMacValue } from "./ecpay"

const TEST_HASH_KEY = "pwFHCqoQZGmho4w6"
const TEST_HASH_IV = "EkRm7iFT261dpevs"
const TEST_MERCHANT_ID = "3002607"

beforeEach(() => {
  process.env.ECPAY_MERCHANT_ID = TEST_MERCHANT_ID
  process.env.ECPAY_HASH_KEY = TEST_HASH_KEY
  process.env.ECPAY_HASH_IV = TEST_HASH_IV
  process.env.ECPAY_API_BASE_URL = "https://payment-stage.ecpay.com.tw"
  _resetEcpayProvider()
})

afterEach(() => {
  delete process.env.ECPAY_MERCHANT_ID
  delete process.env.ECPAY_HASH_KEY
  delete process.env.ECPAY_HASH_IV
  delete process.env.ECPAY_API_BASE_URL
  _resetEcpayProvider()
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
    successUrl: `https://shop.example.com/p/nextjs-course/thanks?order=${ORDER_ID}&token=abc`,
    cancelUrl: "https://shop.example.com/p/nextjs-course",
  }
}

describe("EcpayProvider.createCheckout({ mode: 'one-time' })", () => {
  it("builds a plain order form: TotalAmount = order amount, NO 定期定額 fields", async () => {
    const provider = new EcpayProvider()
    const result = await provider.createCheckout(oneTimeArgs())
    const fields = parseFormFields(result.checkoutUrl)

    // Single charge amount comes from args.amount (server-owned order snapshot).
    expect(fields["TotalAmount"]).toBe("1200")

    // NOT a 定期定額 order — none of the recurring params may appear.
    for (const recurringField of [
      "PeriodAmount",
      "PeriodType",
      "Frequency",
      "ExecTimes",
      "PeriodReturnURL",
    ]) {
      expect(fields).not.toHaveProperty(recurringField)
    }
  })

  it("produces a valid CheckMacValue on the one-time form", async () => {
    const provider = new EcpayProvider()
    const result = await provider.createCheckout(oneTimeArgs())
    const fields = parseFormFields(result.checkoutUrl)

    expect(fields["CheckMacValue"]).toBeTruthy()
    expect(verifyCheckMacValue(fields, TEST_HASH_KEY, TEST_HASH_IV)).toBe(true)
  })

  it("carries orders.id in CustomField3 and uses an ORD trade number", async () => {
    const provider = new EcpayProvider()
    const result = await provider.createCheckout(oneTimeArgs())
    const fields = parseFormFields(result.checkoutUrl)

    expect(fields["CustomField3"]).toBe(ORDER_ID)
    expect(result.sessionId).toMatch(/^ORD/)
    expect(fields["MerchantTradeNo"]).toBe(result.sessionId)
    // The AIO basics are still present.
    expect(fields["MerchantID"]).toBe(TEST_MERCHANT_ID)
    expect(fields["PaymentType"]).toBe("aio")
    expect(fields["ChoosePayment"]).toBe("Credit")
    expect(fields["ReturnURL"]).toContain("/api/billing/ecpay/return")
    // Buyer's browser lands on the thanks page after payment.
    expect(fields["ClientBackURL"]).toBe(oneTimeArgs().successUrl)
  })

  it("throws PaymentProviderError for a missing / non-positive amount", async () => {
    const provider = new EcpayProvider()
    await expect(
      provider.createCheckout({ ...oneTimeArgs(), amount: 0 }),
    ).rejects.toThrow("Invalid one-time amount")
    await expect(
      provider.createCheckout({ ...oneTimeArgs(), amount: undefined }),
    ).rejects.toThrow("Invalid one-time amount")
  })
})

describe("REGRESSION — subscription checkout is unchanged by the one-time branch", () => {
  it("no mode (legacy call) still builds the 定期定額 form", async () => {
    const provider = new EcpayProvider()
    const result = await provider.createCheckout({
      planId: "month:299:Pro Plan",
      userId: "user_123",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    })
    const fields = parseFormFields(result.checkoutUrl)

    // Recurring params present, exactly as the E236 behavior.
    expect(fields["PeriodAmount"]).toBe("299")
    expect(fields["PeriodType"]).toBe("M")
    expect(fields["Frequency"]).toBe("1")
    expect(fields["ExecTimes"]).toBe("999")
    expect(fields["PeriodReturnURL"]).toContain("/api/billing/ecpay/period")
    expect(result.sessionId).toMatch(/^SUB/)
    expect(verifyCheckMacValue(fields, TEST_HASH_KEY, TEST_HASH_IV)).toBe(true)
  })

  it("explicit mode: 'subscription' also keeps the recurring path", async () => {
    const provider = new EcpayProvider()
    const result = await provider.createCheckout({
      planId: "year:2990:Pro Yearly",
      mode: "subscription",
      userId: "user_456",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    })
    const fields = parseFormFields(result.checkoutUrl)
    expect(fields["PeriodType"]).toBe("Y")
    expect(fields["ExecTimes"]).toBe("99")
  })
})
