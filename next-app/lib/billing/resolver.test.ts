/**
 * E231 / E235 — PaymentProvider resolver tests
 *
 * Verifies:
 *   1. Default provider key is "stripe" when BILLING_PROVIDER is unset.
 *   2. resolveProviderKey() returns the env-configured key.
 *   3. Unimplemented slots (tappay / newebpay) throw a clear descriptive error.
 *   4. Unknown provider values throw a clear error.
 *   5. resolvePaymentProvider() returns a StripeProvider for stripe (E235).
 *   6. resolvePaymentProvider() still throws for ecpay (not yet implemented).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resolvePaymentProvider, resolveProviderKey } from "./resolver"

// Mock the Stripe provider so resolver tests don't need STRIPE_SECRET_KEY
vi.mock("./providers/stripe", () => ({
  getStripeProvider: () => ({ name: "stripe" }),
}))

// Mock the ECPay provider so resolver tests don't need ECPAY_* env vars
vi.mock("./providers/ecpay", () => ({
  getEcpayProvider: () => ({ name: "ecpay" }),
}))

const ENV_KEY = "BILLING_PROVIDER"

function setEnv(value: string | undefined) {
  if (value === undefined) {
    delete process.env[ENV_KEY]
  } else {
    process.env[ENV_KEY] = value
  }
}

describe("resolveProviderKey()", () => {
  afterEach(() => {
    delete process.env[ENV_KEY]
  })

  it("returns 'stripe' when BILLING_PROVIDER is not set", () => {
    setEnv(undefined)
    expect(resolveProviderKey()).toBe("stripe")
  })

  it("returns 'stripe' when BILLING_PROVIDER=stripe", () => {
    setEnv("stripe")
    expect(resolveProviderKey()).toBe("stripe")
  })

  it("returns 'ecpay' when BILLING_PROVIDER=ecpay", () => {
    setEnv("ecpay")
    expect(resolveProviderKey()).toBe("ecpay")
  })

  it("returns 'tappay' when BILLING_PROVIDER=tappay (reserved slot)", () => {
    setEnv("tappay")
    expect(resolveProviderKey()).toBe("tappay")
  })

  it("returns 'newebpay' when BILLING_PROVIDER=newebpay (reserved slot)", () => {
    setEnv("newebpay")
    expect(resolveProviderKey()).toBe("newebpay")
  })

  it("is case-insensitive — BILLING_PROVIDER=STRIPE resolves to 'stripe'", () => {
    setEnv("STRIPE")
    expect(resolveProviderKey()).toBe("stripe")
  })

  it("throws a clear error for an unknown provider string", () => {
    setEnv("paypal")
    expect(() => resolveProviderKey()).toThrowError(/Unknown BILLING_PROVIDER value/)
    expect(() => resolveProviderKey()).toThrowError(/paypal/)
  })
})

describe("resolvePaymentProvider() — reserved slot errors", () => {
  beforeEach(() => {
    delete process.env[ENV_KEY]
  })

  afterEach(() => {
    delete process.env[ENV_KEY]
  })

  it("throws a clear error for tappay slot (not yet implemented)", async () => {
    setEnv("tappay")
    await expect(resolvePaymentProvider()).rejects.toThrowError(
      /tappay.*reserved.*not yet implemented/i,
    )
  })

  it("throws a clear error for newebpay slot (not yet implemented)", async () => {
    setEnv("newebpay")
    await expect(resolvePaymentProvider()).rejects.toThrowError(
      /newebpay.*reserved.*not yet implemented/i,
    )
  })

  it("error message for tappay references the future epic (P57)", async () => {
    setEnv("tappay")
    await expect(resolvePaymentProvider()).rejects.toThrowError(/P57/)
  })

  it("error message for newebpay references the future epic (P57)", async () => {
    setEnv("newebpay")
    await expect(resolvePaymentProvider()).rejects.toThrowError(/P57/)
  })

  it("returns a StripeProvider for BILLING_PROVIDER=stripe (E235)", async () => {
    setEnv("stripe")
    const provider = await resolvePaymentProvider()
    expect(provider.name).toBe("stripe")
  })

  it("returns an EcpayProvider for BILLING_PROVIDER=ecpay (E236)", async () => {
    setEnv("ecpay")
    const provider = await resolvePaymentProvider()
    expect(provider.name).toBe("ecpay")
  })

  it("default (no env var) returns a StripeProvider (E235)", async () => {
    setEnv(undefined)
    const provider = await resolvePaymentProvider()
    expect(provider.name).toBe("stripe")
  })
})
