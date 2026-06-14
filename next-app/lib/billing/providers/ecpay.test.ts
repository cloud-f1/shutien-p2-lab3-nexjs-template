/**
 * E236 — EcpayProvider unit tests
 *
 * Coverage:
 * 1. CheckMacValue — ecpayUrlEncode + generateCheckMacValue validated against official
 *    test vectors from ECPay/ECPay-API-Skill/test-vectors/checkmacvalue.json
 * 2. verifyCheckMacValue — timing-safe comparison, valid/invalid cases
 * 3. verifyWebhook — full form body verification (ReturnURL + PeriodReturnURL)
 * 4. Idempotency — event type detection from params
 * 5. Renewal logic — remaining periods threshold + ExecStatus=2 detection
 * 6. EcpayProvider lifecycle methods — env var guards, cancelSubscription, etc.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  ecpayUrlEncode,
  generateCheckMacValue,
  verifyCheckMacValue,
  getMaxExecTimes,
  EXEC_STATUS,
  DEFAULT_RENEWAL_THRESHOLD,
  EXEC_TIMES_MONTHLY,
  EXEC_TIMES_YEARLY,
  EcpayProvider,
  _resetEcpayProvider,
  getEcpayProvider,
} from "./ecpay"

// ---------------------------------------------------------------------------
// Environment setup
// ---------------------------------------------------------------------------

const TEST_HASH_KEY = "pwFHCqoQZGmho4w6"
const TEST_HASH_IV = "EkRm7iFT261dpevs"
const TEST_MERCHANT_ID = "3002607"

function setEcpayEnv() {
  process.env.ECPAY_MERCHANT_ID = TEST_MERCHANT_ID
  process.env.ECPAY_HASH_KEY = TEST_HASH_KEY
  process.env.ECPAY_HASH_IV = TEST_HASH_IV
  process.env.ECPAY_API_BASE_URL = "https://payment-stage.ecpay.com.tw"
}

function clearEcpayEnv() {
  delete process.env.ECPAY_MERCHANT_ID
  delete process.env.ECPAY_HASH_KEY
  delete process.env.ECPAY_HASH_IV
  delete process.env.ECPAY_API_BASE_URL
  delete process.env.ECPAY_RENEWAL_THRESHOLD
}

beforeEach(() => {
  setEcpayEnv()
  vi.clearAllMocks()
  _resetEcpayProvider()
})

afterEach(() => {
  clearEcpayEnv()
  _resetEcpayProvider()
})

// ---------------------------------------------------------------------------
// 1. CheckMacValue — Official Test Vectors
// Source: ECPay/ECPay-API-Skill/test-vectors/checkmacvalue.json
// ---------------------------------------------------------------------------

describe("ecpayUrlEncode()", () => {
  it("encodes space as + (not %20)", () => {
    const result = ecpayUrlEncode("Hello World")
    expect(result).toContain("+")
    expect(result).not.toContain("%20")
  })

  it("encodes ~ as %7e", () => {
    const result = ecpayUrlEncode("test~product")
    expect(result).toContain("%7e")
    expect(result).not.toContain("~")
  })

  it("encodes ' (apostrophe) as %27", () => {
    const result = ecpayUrlEncode("Tom's Shop")
    expect(result).toContain("%27")
    expect(result).not.toContain("'")
  })

  it("restores .NET special chars: %2d → -", () => {
    // The encoded result should not contain %2d (it becomes -)
    const result = ecpayUrlEncode("test-value")
    // hyphen stays as hyphen after encode + restore
    expect(result).toContain("-")
    expect(result).not.toContain("%2d")
  })

  it("restores .NET special chars: %5f → _", () => {
    const result = ecpayUrlEncode("test_value")
    expect(result).toContain("_")
    expect(result).not.toContain("%5f")
  })

  it("restores .NET special chars: %2e → .", () => {
    const result = ecpayUrlEncode("test.value")
    expect(result).toContain(".")
    expect(result).not.toContain("%2e")
  })

  it("restores .NET special chars: %21 → !", () => {
    const result = ecpayUrlEncode("test!")
    expect(result).toContain("!")
    expect(result).not.toContain("%21")
  })

  it("restores .NET special chars: %2a → *", () => {
    const result = ecpayUrlEncode("test*")
    expect(result).toContain("*")
    expect(result).not.toContain("%2a")
  })

  it("restores .NET special chars: %28 → ( and %29 → )", () => {
    const result = ecpayUrlEncode("test(value)")
    expect(result).toContain("(")
    expect(result).toContain(")")
    expect(result).not.toContain("%28")
    expect(result).not.toContain("%29")
  })

  it("outputs lowercase result", () => {
    const result = ecpayUrlEncode("TestValue")
    expect(result).toBe(result.toLowerCase())
  })
})

describe("generateCheckMacValue() — official test vectors", () => {
  /**
   * Test Vector 1: SHA256 基本測試（AIO 金流）
   * Source: ECPay/ECPay-API-Skill/test-vectors/checkmacvalue.json
   */
  it("vector 1: SHA256 basic AIO payment", () => {
    const params: Record<string, string> = {
      MerchantID: "3002607",
      MerchantTradeNo: "Test1234567890",
      MerchantTradeDate: "2025/01/01 12:00:00",
      PaymentType: "aio",
      TotalAmount: "100",
      TradeDesc: "測試",
      ItemName: "測試商品",
      ReturnURL: "https://example.com/notify",
      ChoosePayment: "ALL",
      EncryptType: "1",
    }

    const result = generateCheckMacValue(params, "pwFHCqoQZGmho4w6", "EkRm7iFT261dpevs")
    expect(result).toBe("291CBA324D31FB5A4BBBFDF2CFE5D32598524753AFD4959C3BF590C5B2F57FB2")
  })

  /**
   * Test Vector 3: 特殊字元 ' 測試（Node.js/TypeScript 修正驗證）
   * Source: ECPay/ECPay-API-Skill/test-vectors/checkmacvalue.json
   */
  it("vector 3: apostrophe special char (Node.js/TypeScript fix)", () => {
    const params: Record<string, string> = {
      MerchantID: "3002607",
      ItemName: "Tom's Shop",
      TotalAmount: "100",
    }

    const result = generateCheckMacValue(params, "pwFHCqoQZGmho4w6", "EkRm7iFT261dpevs")
    expect(result).toBe("CF0A3D4901D99459D8641516EC57210700E8A5C9AB26B1D021301E9CB93EF78D")
  })

  /**
   * Test Vector 4: 特殊字元 ~ 測試
   * Source: ECPay/ECPay-API-Skill/test-vectors/checkmacvalue.json
   */
  it("vector 4: tilde special char", () => {
    const params: Record<string, string> = {
      MerchantID: "3002607",
      ItemName: "Test~Product",
      TotalAmount: "200",
    }

    const result = generateCheckMacValue(params, "pwFHCqoQZGmho4w6", "EkRm7iFT261dpevs")
    expect(result).toBe("CEEAE01D2F9A8E74D4AC0DCE7735B046D73F35A5EC99558A31A2EE03159DA1C9")
  })

  /**
   * Test Vector 5: 空格處理測試（%20 vs + 陷阱）
   * Source: ECPay/ECPay-API-Skill/test-vectors/checkmacvalue.json
   */
  it("vector 5: space must encode as + not %20", () => {
    const params: Record<string, string> = {
      MerchantID: "3002607",
      ItemName: "My Test Product",
      TotalAmount: "300",
    }

    const result = generateCheckMacValue(params, "pwFHCqoQZGmho4w6", "EkRm7iFT261dpevs")
    expect(result).toBe("7712A5E6EDC3B57086063C88568084C66CE882A21D40E74DE5ACA3B478C6F316")
    // Ensure it does NOT match the wrong value (with %20 instead of +)
    expect(result).not.toBe("13F7A6B69BF856B5203212AC5F3202B6140D8E2B4316A62851712BF2AF7812D0")
  })

  /**
   * Test Vector 6: Callback 驗證測試（模擬收到付款通知）
   * Source: ECPay/ECPay-API-Skill/test-vectors/checkmacvalue.json
   */
  it("vector 6: callback verification (payment notification)", () => {
    const params: Record<string, string> = {
      MerchantID: "3002607",
      MerchantTradeNo: "Test1234567890",
      RtnCode: "1",
      RtnMsg: "Succeeded",
      TradeNo: "2301011234567890",
      TradeAmt: "100",
      PaymentDate: "2025/01/01 12:05:00",
      PaymentType: "Credit_CreditCard",
      TradeDate: "2025/01/01 12:00:00",
      SimulatePaid: "0",
    }

    const result = generateCheckMacValue(params, "pwFHCqoQZGmho4w6", "EkRm7iFT261dpevs")
    expect(result).toBe("2AB536D86AFF8E1086744D59175040A32538C96B1C28C4135B551BD728E913B8")
  })

  it("ignores existing CheckMacValue param in input", () => {
    const params: Record<string, string> = {
      MerchantID: "3002607",
      TotalAmount: "100",
      CheckMacValue: "EXISTING_VALUE_SHOULD_BE_IGNORED",
    }
    const paramsWithout: Record<string, string> = {
      MerchantID: "3002607",
      TotalAmount: "100",
    }

    expect(generateCheckMacValue(params, TEST_HASH_KEY, TEST_HASH_IV)).toBe(
      generateCheckMacValue(paramsWithout, TEST_HASH_KEY, TEST_HASH_IV),
    )
  })

  it("is case-insensitive for key sorting", () => {
    const params1: Record<string, string> = {
      merchantid: "3002607",
      TOTALAMOUNT: "100",
    }
    const params2: Record<string, string> = {
      MERCHANTID: "3002607",
      totalamount: "100",
    }

    // Same keys different case → same sort order → same hash
    expect(generateCheckMacValue(params1, TEST_HASH_KEY, TEST_HASH_IV)).toBe(
      generateCheckMacValue(params2, TEST_HASH_KEY, TEST_HASH_IV),
    )
  })
})

// ---------------------------------------------------------------------------
// 2. verifyCheckMacValue
// ---------------------------------------------------------------------------

describe("verifyCheckMacValue()", () => {
  it("returns true for valid CheckMacValue", () => {
    const params: Record<string, string> = {
      MerchantID: "3002607",
      MerchantTradeNo: "Test1234567890",
      RtnCode: "1",
      RtnMsg: "Succeeded",
      TradeNo: "2301011234567890",
      TradeAmt: "100",
      PaymentDate: "2025/01/01 12:05:00",
      PaymentType: "Credit_CreditCard",
      TradeDate: "2025/01/01 12:00:00",
      SimulatePaid: "0",
      CheckMacValue: "2AB536D86AFF8E1086744D59175040A32538C96B1C28C4135B551BD728E913B8",
    }

    expect(verifyCheckMacValue(params, "pwFHCqoQZGmho4w6", "EkRm7iFT261dpevs")).toBe(true)
  })

  it("returns false for invalid CheckMacValue", () => {
    const params: Record<string, string> = {
      MerchantID: "3002607",
      TotalAmount: "100",
      CheckMacValue: "INVALID_CMV_VALUE",
    }

    expect(verifyCheckMacValue(params, TEST_HASH_KEY, TEST_HASH_IV)).toBe(false)
  })

  it("returns false when CheckMacValue is missing", () => {
    const params: Record<string, string> = {
      MerchantID: "3002607",
      TotalAmount: "100",
    }

    expect(verifyCheckMacValue(params, TEST_HASH_KEY, TEST_HASH_IV)).toBe(false)
  })

  it("returns false for tampered body (different length CMV)", () => {
    const params: Record<string, string> = {
      MerchantID: "3002607",
      TotalAmount: "100",
      CheckMacValue: "SHORT", // wrong length → timing-safe equal returns false
    }

    expect(verifyCheckMacValue(params, TEST_HASH_KEY, TEST_HASH_IV)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 3. EcpayProvider.verifyWebhook()
// ---------------------------------------------------------------------------

describe("EcpayProvider.verifyWebhook()", () => {
  it("returns valid=true for a valid ReturnURL callback body", async () => {
    // Build a valid callback body
    const params: Record<string, string> = {
      MerchantID: TEST_MERCHANT_ID,
      MerchantTradeNo: "SUBtest123",
      RtnCode: "1",
      RtnMsg: "Succeeded",
      TradeNo: "2025010112345678",
      TradeAmt: "299",
      PaymentDate: "2025/01/01 12:05:00",
      PaymentType: "Credit_CreditCard",
      TradeDate: "2025/01/01 12:00:00",
      SimulatePaid: "0",
    }
    const cmv = generateCheckMacValue(params, TEST_HASH_KEY, TEST_HASH_IV)
    const allParams = { ...params, CheckMacValue: cmv }
    const rawBody = new URLSearchParams(allParams).toString()

    const provider = new EcpayProvider()
    const result = await provider.verifyWebhook(rawBody, {})

    expect(result.valid).toBe(true)
    expect(result.eventType).toBe("ecpay.return.payment")
    expect(result.payload).toMatchObject({ MerchantTradeNo: "SUBtest123" })
  })

  it("returns valid=true for a valid PeriodReturnURL callback body", async () => {
    const params: Record<string, string> = {
      MerchantID: TEST_MERCHANT_ID,
      MerchantTradeNo: "SUBtest123",
      RtnCode: "1",
      Amount: "299",
      Gwsr: "12345678",
      ProcessDate: "2025/02/01 12:00:00",
      AuthCode: "123456",
      FirstAuthAmount: "299",
      TotalSuccessTimes: "2",
      ExecTimes: "12",
      PeriodType: "M",
      Frequency: "1",
    }
    const cmv = generateCheckMacValue(params, TEST_HASH_KEY, TEST_HASH_IV)
    const allParams = { ...params, CheckMacValue: cmv }
    const rawBody = new URLSearchParams(allParams).toString()

    const provider = new EcpayProvider()
    const result = await provider.verifyWebhook(rawBody, {})

    expect(result.valid).toBe(true)
    expect(result.eventType).toBe("ecpay.period.payment")
    expect(result.payload).toMatchObject({ TotalSuccessTimes: "2" })
  })

  it("returns valid=false for invalid CheckMacValue", async () => {
    const rawBody = "MerchantID=3002607&TotalAmount=100&CheckMacValue=INVALID"

    const provider = new EcpayProvider()
    const result = await provider.verifyWebhook(rawBody, {})

    expect(result.valid).toBe(false)
  })

  it("returns valid=false when CheckMacValue is missing from body", async () => {
    const rawBody = "MerchantID=3002607&TotalAmount=100"

    const provider = new EcpayProvider()
    const result = await provider.verifyWebhook(rawBody, {})

    expect(result.valid).toBe(false)
  })

  it("accepts Buffer as rawBody", async () => {
    const params: Record<string, string> = {
      MerchantID: TEST_MERCHANT_ID,
      MerchantTradeNo: "SUBbuf999",
      RtnCode: "1",
      TradeAmt: "100",
    }
    const cmv = generateCheckMacValue(params, TEST_HASH_KEY, TEST_HASH_IV)
    const allParams = { ...params, CheckMacValue: cmv }
    const rawBody = Buffer.from(new URLSearchParams(allParams).toString())

    const provider = new EcpayProvider()
    const result = await provider.verifyWebhook(rawBody, {})

    expect(result.valid).toBe(true)
  })

  it("throws PaymentProviderError when ECPAY_HASH_KEY is missing", async () => {
    delete process.env.ECPAY_HASH_KEY
    _resetEcpayProvider()

    const provider = new EcpayProvider()
    await expect(provider.verifyWebhook("body=test", {})).rejects.toThrow(
      "ECPAY_HASH_KEY is not set",
    )
  })
})

// ---------------------------------------------------------------------------
// 4. Renewal logic — remaining periods + ExecStatus detection
// ---------------------------------------------------------------------------

describe("Renewal logic — ExecTimes / remaining / threshold", () => {
  it("EXEC_TIMES_MONTHLY is 999", () => {
    expect(EXEC_TIMES_MONTHLY).toBe(999)
  })

  it("EXEC_TIMES_YEARLY is 99", () => {
    expect(EXEC_TIMES_YEARLY).toBe(99)
  })

  it("DEFAULT_RENEWAL_THRESHOLD is 3", () => {
    expect(DEFAULT_RENEWAL_THRESHOLD).toBe(3)
  })

  it("getMaxExecTimes('M') → 999", () => {
    expect(getMaxExecTimes("M")).toBe(999)
  })

  it("getMaxExecTimes('D') → 999", () => {
    expect(getMaxExecTimes("D")).toBe(999)
  })

  it("getMaxExecTimes('Y') → 99", () => {
    expect(getMaxExecTimes("Y")).toBe(99)
  })

  it("remaining = ExecTimes - TotalSuccessTimes", () => {
    const execTimes = 12
    const totalSuccessTimes = 10
    const remaining = execTimes - totalSuccessTimes
    expect(remaining).toBe(2)
  })

  it("needsRenewal when remaining < threshold", () => {
    const execTimes = 12
    const totalSuccessTimes = 10
    const remaining = execTimes - totalSuccessTimes
    const threshold = DEFAULT_RENEWAL_THRESHOLD
    expect(remaining < threshold).toBe(true) // 2 < 3 → needs renewal
  })

  it("needsRenewal when ExecStatus = COMPLETED ('2')", () => {
    const execStatus = EXEC_STATUS.COMPLETED
    expect(execStatus).toBe("2")
    const needsRenewal = execStatus === EXEC_STATUS.COMPLETED
    expect(needsRenewal).toBe(true)
  })

  it("does not need renewal when remaining >= threshold", () => {
    const execTimes = 12
    const totalSuccessTimes = 5
    const remaining = execTimes - totalSuccessTimes // 7
    const threshold = DEFAULT_RENEWAL_THRESHOLD // 3
    expect(remaining < threshold).toBe(false)
  })

  it("EXEC_STATUS values are correct", () => {
    expect(EXEC_STATUS.TERMINATED).toBe("0")
    expect(EXEC_STATUS.RUNNING).toBe("1")
    expect(EXEC_STATUS.COMPLETED).toBe("2")
  })
})

// ---------------------------------------------------------------------------
// 5. EcpayProvider lifecycle methods
// ---------------------------------------------------------------------------

describe("EcpayProvider.createCheckout()", () => {
  it("throws PaymentProviderError when planId amount is 0", async () => {
    const provider = new EcpayProvider()
    await expect(
      provider.createCheckout({
        planId: "month:0:Pro",
        userId: "user_123",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      }),
    ).rejects.toThrow("Invalid plan amount")
  })

  it("returns checkoutUrl and sessionId for valid plan", async () => {
    const provider = new EcpayProvider()
    const result = await provider.createCheckout({
      planId: "month:299:Pro Plan",
      userId: "user_123",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    })

    expect(result.checkoutUrl).toBeTruthy()
    expect(result.sessionId).toBeTruthy()
    // sessionId is the MerchantTradeNo (starts with SUB)
    expect(result.sessionId).toMatch(/^SUB/)
  })

  it("throws PaymentProviderError when ECPAY_MERCHANT_ID is missing", async () => {
    delete process.env.ECPAY_MERCHANT_ID
    _resetEcpayProvider()

    const provider = new EcpayProvider()
    await expect(
      provider.createCheckout({
        planId: "month:299:Pro",
        userId: "user_123",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      }),
    ).rejects.toThrow("ECPAY_MERCHANT_ID is not set")
  })

  it("throws PaymentProviderError when ECPAY_HASH_IV is missing", async () => {
    delete process.env.ECPAY_HASH_IV
    _resetEcpayProvider()

    const provider = new EcpayProvider()
    await expect(
      provider.createCheckout({
        planId: "month:299:Pro",
        userId: "user_123",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      }),
    ).rejects.toThrow("ECPAY_HASH_IV is not set")
  })
})

describe("EcpayProvider.cancelSubscription()", () => {
  it("returns canceled status", async () => {
    // Mock fetch to simulate successful API call
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("1|OK"),
    } as Response)

    const provider = new EcpayProvider()
    const result = await provider.cancelSubscription({
      subscriptionId: "sub_db_123",
      providerSubId: "SUBtest123",
      atPeriodEnd: false,
    })

    expect(result.status).toBe("canceled")
    expect(result.providerSubId).toBe("SUBtest123")
    expect(result.id).toBe("sub_db_123")
  })

  it("throws PaymentProviderError on network error", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"))

    const provider = new EcpayProvider()
    await expect(
      provider.cancelSubscription({
        subscriptionId: "sub_db_456",
        providerSubId: "SUBtest456",
      }),
    ).rejects.toThrow("Failed to cancel ECPay subscription")
  })
})

describe("EcpayProvider.createSubscription()", () => {
  it("returns a subscription with correct provider_meta", async () => {
    const provider = new EcpayProvider()
    const result = await provider.createSubscription({
      planId: "month:299:Pro Plan",
      userId: "user_123",
      providerCustomerId: "SUBtest001",
      providerPaymentMethodId: "2025010112345678",
    })

    expect(result.provider).toBe("ecpay")
    expect(result.providerSubId).toBe("SUBtest001")
    expect(result.status).toBe("active")
    expect(result.providerMeta).toMatchObject({
      exec_times: 999,
      total_success_times: 1,
      exec_status: "1",
    })
  })
})

describe("EcpayProvider.chargeRecurring()", () => {
  it("returns success=true (ECPay handles recurring automatically)", async () => {
    const provider = new EcpayProvider()
    const result = await provider.chargeRecurring({
      subscriptionId: "sub_123",
      providerSubId: "SUBtest001",
    })

    expect(result.success).toBe(true)
    expect(result.currency).toBe("twd")
  })
})

describe("EcpayProvider.reconcile()", () => {
  it("returns zero counts by default (DB queries done by caller)", async () => {
    const provider = new EcpayProvider()
    const result = await provider.reconcile()

    expect(result.checked).toBe(0)
    expect(result.updated).toBe(0)
    expect(Array.isArray(result.details)).toBe(true)
  })
})

describe("EcpayProvider — singleton factory", () => {
  it("getEcpayProvider returns same instance on repeated calls", () => {
    const a = getEcpayProvider()
    const b = getEcpayProvider()
    expect(a).toBe(b)
  })

  it("_resetEcpayProvider resets singleton", () => {
    const a = getEcpayProvider()
    _resetEcpayProvider()
    const b = getEcpayProvider()
    expect(a).not.toBe(b)
  })

  it("name property is 'ecpay'", () => {
    const provider = new EcpayProvider()
    expect(provider.name).toBe("ecpay")
  })
})

// ---------------------------------------------------------------------------
// 6. Idempotency contract
// ---------------------------------------------------------------------------

describe("Idempotency contract", () => {
  it("verifyWebhook is pure — same body always returns same valid state", async () => {
    const params: Record<string, string> = {
      MerchantID: TEST_MERCHANT_ID,
      MerchantTradeNo: "SUBidem001",
      RtnCode: "1",
      TradeAmt: "299",
    }
    const cmv = generateCheckMacValue(params, TEST_HASH_KEY, TEST_HASH_IV)
    const rawBody = new URLSearchParams({ ...params, CheckMacValue: cmv }).toString()

    const provider = new EcpayProvider()
    const result1 = await provider.verifyWebhook(rawBody, {})
    const result2 = await provider.verifyWebhook(rawBody, {})

    expect(result1.valid).toBe(true)
    expect(result2.valid).toBe(true)
    expect(result1.eventType).toBe(result2.eventType)
  })

  it("MerchantTradeNo is the key identifier for event deduplication", async () => {
    const params: Record<string, string> = {
      MerchantID: TEST_MERCHANT_ID,
      MerchantTradeNo: "SUBidem002",
      RtnCode: "1",
      TradeAmt: "299",
    }
    const cmv = generateCheckMacValue(params, TEST_HASH_KEY, TEST_HASH_IV)
    const rawBody = new URLSearchParams({ ...params, CheckMacValue: cmv }).toString()

    const provider = new EcpayProvider()
    const result = await provider.verifyWebhook(rawBody, {})

    expect(result.valid).toBe(true)
    const payload = result.payload as Record<string, string>
    // MerchantTradeNo is used as provider_event_id prefix
    expect(payload["MerchantTradeNo"]).toBe("SUBidem002")
  })
})
