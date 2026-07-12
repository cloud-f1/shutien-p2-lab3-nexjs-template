/**
 * E327 — StripeProvider one-time checkout tests (the QA gap: createCheckout
 * output shape for mode "one-time" was previously untested).
 *
 * Verifies (SDK mocked per the existing stripe.test.ts pattern):
 * 1. `mode: "one-time"` calls stripe.checkout.sessions.create with
 *    mode "payment" + inline price_data { currency, unit_amount, product_data }.
 * 2. orders.id rides metadata.orderId so the webhook can settle the order.
 * 3. REGRESSION — legacy calls (no mode) still create a "subscription" session
 *    with the price id in line_items.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { StripeProvider, _resetStripeProvider } from "./stripe"

const mockCheckoutCreate = vi.fn()

vi.mock("stripe", () => {
  function MockStripe() {
    return {
      checkout: {
        sessions: {
          create: mockCheckoutCreate,
        },
      },
    }
  }
  return { default: MockStripe }
})

beforeEach(() => {
  vi.clearAllMocks()
  _resetStripeProvider()
  process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_testing"
})

afterEach(() => {
  delete process.env.STRIPE_SECRET_KEY
  _resetStripeProvider()
})

const ORDER_ID = "0f36e34d-9df1-4a3c-9a01-5a111111abcd"

function oneTimeArgs() {
  return {
    planId: "nextjs-course",
    mode: "one-time" as const,
    amount: 1200,
    currency: "TWD",
    productName: "Next.js 全端實戰課程",
    orderId: ORDER_ID,
    userId: "user_123",
    successUrl: `https://shop.example.com/p/nextjs-course/thanks?order=${ORDER_ID}&token=abc`,
    cancelUrl: "https://shop.example.com/p/nextjs-course",
    customerEmail: "buyer@example.com",
  }
}

describe("StripeProvider.createCheckout({ mode: 'one-time' })", () => {
  it("creates a mode:'payment' session with inline price_data (no price id)", async () => {
    mockCheckoutCreate.mockResolvedValueOnce({
      id: "cs_test_onetime_1",
      url: "https://checkout.stripe.com/pay/cs_test_onetime_1",
    })

    const provider = new StripeProvider()
    const result = await provider.createCheckout(oneTimeArgs())

    expect(result.checkoutUrl).toBe("https://checkout.stripe.com/pay/cs_test_onetime_1")
    expect(result.sessionId).toBe("cs_test_onetime_1")

    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "twd",
              unit_amount: 1200,
              product_data: { name: "Next.js 全端實戰課程" },
            },
            quantity: 1,
          },
        ],
        customer_email: "buyer@example.com",
      }),
    )
    // No subscription_data on a one-time session.
    const callArg = mockCheckoutCreate.mock.calls[0]![0] as Record<string, unknown>
    expect(callArg).not.toHaveProperty("subscription_data")
  })

  it("stamps metadata.orderId so the webhook can settle the order", async () => {
    mockCheckoutCreate.mockResolvedValueOnce({
      id: "cs_test_onetime_2",
      url: "https://checkout.stripe.com/pay/cs_test_onetime_2",
    })

    const provider = new StripeProvider()
    await provider.createCheckout(oneTimeArgs())

    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { orderId: ORDER_ID, userId: "user_123" },
      }),
    )
  })

  it("throws PaymentProviderError for a missing / non-positive amount", async () => {
    const provider = new StripeProvider()
    await expect(
      provider.createCheckout({ ...oneTimeArgs(), amount: 0 }),
    ).rejects.toThrow("Invalid one-time amount")
    await expect(
      provider.createCheckout({ ...oneTimeArgs(), amount: undefined }),
    ).rejects.toThrow("Invalid one-time amount")
    expect(mockCheckoutCreate).not.toHaveBeenCalled()
  })

  it("throws PaymentProviderError when Stripe returns no URL", async () => {
    mockCheckoutCreate.mockResolvedValueOnce({ id: "cs_no_url", url: null })
    const provider = new StripeProvider()
    await expect(provider.createCheckout(oneTimeArgs())).rejects.toThrow("no URL")
  })
})

describe("REGRESSION — subscription checkout is unchanged by the one-time branch", () => {
  it("no mode (legacy call) still creates a mode:'subscription' session with the price id", async () => {
    mockCheckoutCreate.mockResolvedValueOnce({
      id: "cs_test_sub_1",
      url: "https://checkout.stripe.com/pay/cs_test_sub_1",
    })

    const provider = new StripeProvider()
    await provider.createCheckout({
      planId: "price_pro_monthly",
      userId: "user_456",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    })

    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_pro_monthly", quantity: 1 }],
        metadata: { userId: "user_456", planId: "price_pro_monthly" },
        subscription_data: {
          metadata: { userId: "user_456", planId: "price_pro_monthly" },
        },
      }),
    )
  })
})
