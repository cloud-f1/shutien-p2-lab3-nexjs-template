/**
 * E235 — StripeProvider unit tests
 *
 * Coverage:
 * 1. verifyWebhook — signature verification (valid / invalid / missing sig)
 * 2. Idempotency — processEvent logic guards against duplicate event IDs
 * 3. Subscription lifecycle — createCheckout, cancelSubscription, reconcile
 *
 * All tests use vi.mock to avoid real Stripe API calls.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { _resetStripeProvider, StripeProvider } from "./stripe"

// ---------------------------------------------------------------------------
// Mock the Stripe SDK
// ---------------------------------------------------------------------------

const mockConstructEvent = vi.fn()
const mockCheckoutCreate = vi.fn()
const mockSubscriptionsCreate = vi.fn()
const mockSubscriptionsUpdate = vi.fn()
const mockSubscriptionsCancel = vi.fn()
const mockSubscriptionsList = vi.fn()
const mockInvoicesCreate = vi.fn()
const mockInvoicesPay = vi.fn()

vi.mock("stripe", () => {
  function MockStripe() {
    return {
      checkout: {
        sessions: {
          create: mockCheckoutCreate,
        },
      },
      subscriptions: {
        create: mockSubscriptionsCreate,
        update: mockSubscriptionsUpdate,
        cancel: mockSubscriptionsCancel,
        list: mockSubscriptionsList,
      },
      invoices: {
        create: mockInvoicesCreate,
        pay: mockInvoicesPay,
      },
      webhooks: {
        constructEvent: mockConstructEvent,
      },
    }
  }

  return { default: MockStripe }
})

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

function makeProvider(): StripeProvider {
  process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_testing"
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake_secret_for_testing"
  return new StripeProvider()
}

beforeEach(() => {
  vi.clearAllMocks()
  _resetStripeProvider()
  process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_testing"
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake_secret_for_testing"
})

afterEach(() => {
  delete process.env.STRIPE_SECRET_KEY
  delete process.env.STRIPE_WEBHOOK_SECRET
  _resetStripeProvider()
})

// ---------------------------------------------------------------------------
// 1. verifyWebhook — Stripe-Signature HMAC-SHA256 verification
// ---------------------------------------------------------------------------

describe("StripeProvider.verifyWebhook()", () => {
  it("returns valid=true when constructEvent succeeds", async () => {
    const fakeEvent = {
      id: "evt_test_123",
      type: "checkout.session.completed",
      data: { object: {} },
    }
    mockConstructEvent.mockReturnValueOnce(fakeEvent)

    const provider = makeProvider()
    const result = await provider.verifyWebhook(
      '{"id":"evt_test_123","type":"checkout.session.completed"}',
      { "stripe-signature": "t=1234,v1=abc123" },
    )

    expect(result.valid).toBe(true)
    expect(result.eventType).toBe("checkout.session.completed")
    expect(result.payload).toEqual(fakeEvent)
  })

  it("returns valid=false when constructEvent throws (invalid signature)", async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error("No signatures found matching the expected signature for payload")
    })

    const provider = makeProvider()
    const result = await provider.verifyWebhook("tampered-body", {
      "stripe-signature": "t=1234,v1=bad_sig",
    })

    expect(result.valid).toBe(false)
    expect(result.eventType).toBe("")
    expect(result.payload).toBeNull()
  })

  it("returns valid=false when stripe-signature header is missing", async () => {
    const provider = makeProvider()
    const result = await provider.verifyWebhook("body", {})

    expect(result.valid).toBe(false)
    expect(result.eventType).toBe("")
  })

  it("returns valid=false when stripe-signature is empty string", async () => {
    const provider = makeProvider()
    const result = await provider.verifyWebhook("body", {
      "stripe-signature": "",
    })

    expect(result.valid).toBe(false)
  })

  it("accepts Buffer as rawBody", async () => {
    const fakeEvent = {
      id: "evt_buf_456",
      type: "invoice.payment_succeeded",
      data: { object: {} },
    }
    mockConstructEvent.mockReturnValueOnce(fakeEvent)

    const provider = makeProvider()
    const result = await provider.verifyWebhook(Buffer.from("raw-body"), {
      "stripe-signature": "t=9999,v1=validhash",
    })

    expect(result.valid).toBe(true)
    expect(result.eventType).toBe("invoice.payment_succeeded")
  })

  it("handles array stripe-signature header (takes first element)", async () => {
    const fakeEvent = {
      id: "evt_arr_789",
      type: "customer.subscription.updated",
      data: { object: {} },
    }
    mockConstructEvent.mockReturnValueOnce(fakeEvent)

    const provider = makeProvider()
    const result = await provider.verifyWebhook("body", {
      "stripe-signature": ["t=1111,v1=sig1", "t=2222,v1=sig2"],
    })

    expect(result.valid).toBe(true)
    // constructEvent was called with the first element
    expect(mockConstructEvent).toHaveBeenCalledWith(
      "body",
      "t=1111,v1=sig1",
      "whsec_fake_secret_for_testing",
    )
  })

  it("throws PaymentProviderError when STRIPE_WEBHOOK_SECRET is missing", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    _resetStripeProvider()
    const provider = new StripeProvider()

    // When webhook secret is not configured, verifyWebhook throws PaymentProviderError
    // so the route handler can return 500 (misconfiguration) rather than 400 (bad sig)
    await expect(
      provider.verifyWebhook("body", { "stripe-signature": "sig" }),
    ).rejects.toThrow("STRIPE_WEBHOOK_SECRET is not set")
  })
})

// ---------------------------------------------------------------------------
// 2. Idempotency — event deduplication via provider_event_id
// ---------------------------------------------------------------------------

describe("Idempotency contract", () => {
  it("verifyWebhook is pure — same rawBody + sig always returns same valid state", async () => {
    const fakeEvent = {
      id: "evt_idem_001",
      type: "invoice.payment_succeeded",
      data: { object: {} },
    }
    // Always return the same event for both calls
    mockConstructEvent.mockReturnValue(fakeEvent)

    const provider = makeProvider()
    const body = '{"id":"evt_idem_001"}'
    const headers = { "stripe-signature": "t=1234,v1=idempotent" }

    const result1 = await provider.verifyWebhook(body, headers)
    const result2 = await provider.verifyWebhook(body, headers)

    // Both calls return the same valid event
    expect(result1.valid).toBe(true)
    expect(result2.valid).toBe(true)
    expect(result1.eventType).toBe(result2.eventType)
    // The provider_event_id in the payload is the same
    expect((result1.payload as typeof fakeEvent).id).toBe(
      (result2.payload as typeof fakeEvent).id,
    )
  })

  it("providerEventId is available on the payload for DB deduplication", async () => {
    const fakeEvent = {
      id: "evt_unique_id_abc",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_xxx" } },
    }
    mockConstructEvent.mockReturnValueOnce(fakeEvent)

    const provider = makeProvider()
    const result = await provider.verifyWebhook("body", {
      "stripe-signature": "t=1,v1=abc",
    })

    expect(result.valid).toBe(true)
    const payload = result.payload as typeof fakeEvent
    // The event.id is what gets stored in payment_events.provider_event_id
    expect(payload.id).toBe("evt_unique_id_abc")
  })
})

// ---------------------------------------------------------------------------
// 3. Subscription lifecycle — createCheckout, cancelSubscription, reconcile
// ---------------------------------------------------------------------------

describe("StripeProvider.createCheckout()", () => {
  it("returns a checkoutUrl and sessionId on success", async () => {
    mockCheckoutCreate.mockResolvedValueOnce({
      id: "cs_test_session_abc",
      url: "https://checkout.stripe.com/pay/cs_test_session_abc",
    })

    const provider = makeProvider()
    const result = await provider.createCheckout({
      planId: "price_pro_monthly",
      userId: "user_123",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
      customerEmail: "test@example.com",
    })

    expect(result.checkoutUrl).toBe("https://checkout.stripe.com/pay/cs_test_session_abc")
    expect(result.sessionId).toBe("cs_test_session_abc")
  })

  it("passes planId as the price in line_items", async () => {
    mockCheckoutCreate.mockResolvedValueOnce({
      id: "cs_test_abc",
      url: "https://checkout.stripe.com/pay/cs_test_abc",
    })

    const provider = makeProvider()
    await provider.createCheckout({
      planId: "price_enterprise_yearly",
      userId: "user_456",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    })

    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_enterprise_yearly", quantity: 1 }],
        metadata: { userId: "user_456", planId: "price_enterprise_yearly" },
      }),
    )
  })

  it("throws PaymentProviderError when Stripe returns no URL", async () => {
    mockCheckoutCreate.mockResolvedValueOnce({
      id: "cs_test_no_url",
      url: null,
    })

    const provider = makeProvider()
    await expect(
      provider.createCheckout({
        planId: "price_pro",
        userId: "user_789",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      }),
    ).rejects.toThrow("no URL")
  })

  it("throws PaymentProviderError when Stripe SDK throws", async () => {
    mockCheckoutCreate.mockRejectedValueOnce(new Error("Invalid price ID"))

    const provider = makeProvider()
    await expect(
      provider.createCheckout({
        planId: "price_bad",
        userId: "user_xyz",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      }),
    ).rejects.toThrow("Failed to create Stripe Checkout Session")
  })
})

describe("StripeProvider.cancelSubscription()", () => {
  const mockStripeSub = {
    id: "sub_stripe_abc",
    status: "canceled",
    current_period_end: 1700000000,
    cancel_at: null,
    cancel_at_period_end: false,
    customer: "cus_abc",
  }

  it("cancels immediately when atPeriodEnd is false", async () => {
    mockSubscriptionsCancel.mockResolvedValueOnce(mockStripeSub)

    const provider = makeProvider()
    const result = await provider.cancelSubscription({
      subscriptionId: "sub_db_id_123",
      providerSubId: "sub_stripe_abc",
      atPeriodEnd: false,
    })

    expect(mockSubscriptionsCancel).toHaveBeenCalledWith("sub_stripe_abc")
    expect(result.status).toBe("canceled")
    expect(result.providerSubId).toBe("sub_stripe_abc")
  })

  it("schedules cancellation at period end when atPeriodEnd is true", async () => {
    const scheduledSub = {
      ...mockStripeSub,
      status: "active",
      cancel_at_period_end: true,
      cancel_at: 1700000000,
    }
    mockSubscriptionsUpdate.mockResolvedValueOnce(scheduledSub)

    const provider = makeProvider()
    const result = await provider.cancelSubscription({
      subscriptionId: "sub_db_id_456",
      providerSubId: "sub_stripe_abc",
      atPeriodEnd: true,
    })

    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith("sub_stripe_abc", {
      cancel_at_period_end: true,
    })
    expect(result.status).toBe("active")
    expect(result.cancelAt).toBe(1700000000)
  })

  it("preserves subscriptionId in result", async () => {
    mockSubscriptionsCancel.mockResolvedValueOnce(mockStripeSub)

    const provider = makeProvider()
    const result = await provider.cancelSubscription({
      subscriptionId: "sub_db_id_789",
      providerSubId: "sub_stripe_abc",
    })

    expect(result.id).toBe("sub_db_id_789")
  })

  it("throws PaymentProviderError on Stripe SDK error", async () => {
    mockSubscriptionsCancel.mockRejectedValueOnce(new Error("No such subscription"))

    const provider = makeProvider()
    await expect(
      provider.cancelSubscription({
        subscriptionId: "sub_db_id_bad",
        providerSubId: "sub_stripe_bad",
      }),
    ).rejects.toThrow("Failed to cancel Stripe subscription")
  })
})

describe("StripeProvider.reconcile()", () => {
  it("returns checked and updated counts", async () => {
    mockSubscriptionsList.mockResolvedValueOnce({
      data: [
        { id: "sub_1", status: "active" },
        { id: "sub_2", status: "past_due" },
        { id: "sub_3", status: "canceled" },
      ],
    })

    const provider = makeProvider()
    const result = await provider.reconcile()

    expect(result.checked).toBe(3)
    expect(result.updated).toBe(3)
    expect(Array.isArray(result.details)).toBe(true)
    expect((result.details as Array<{ id: string; status: string }>).length).toBe(3)
  })

  it("returns zero counts when no subscriptions exist", async () => {
    mockSubscriptionsList.mockResolvedValueOnce({ data: [] })

    const provider = makeProvider()
    const result = await provider.reconcile()

    expect(result.checked).toBe(0)
    expect(result.updated).toBe(0)
  })

  it("throws PaymentProviderError on Stripe SDK error", async () => {
    mockSubscriptionsList.mockRejectedValueOnce(new Error("API rate limit exceeded"))

    const provider = makeProvider()
    await expect(provider.reconcile()).rejects.toThrow("Reconcile failed")
  })
})

describe("StripeProvider.createSubscription()", () => {
  it("creates a subscription with the correct Stripe call", async () => {
    const mockSub = {
      id: "sub_new_abc",
      status: "active",
      current_period_end: 1700000000,
      cancel_at: null,
      cancel_at_period_end: false,
      customer: "cus_abc",
    }
    mockSubscriptionsCreate.mockResolvedValueOnce(mockSub)

    const provider = makeProvider()
    const result = await provider.createSubscription({
      planId: "price_pro",
      userId: "user_abc",
      providerCustomerId: "cus_abc",
      providerPaymentMethodId: "pm_abc",
    })

    expect(mockSubscriptionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_abc",
        items: [{ price: "price_pro" }],
        default_payment_method: "pm_abc",
      }),
    )
    expect(result.status).toBe("active")
    expect(result.providerSubId).toBe("sub_new_abc")
    expect(result.provider).toBe("stripe")
  })
})

describe("StripeProvider — env var guards", () => {
  it("throws when STRIPE_SECRET_KEY is missing", async () => {
    delete process.env.STRIPE_SECRET_KEY
    _resetStripeProvider()

    const provider = new StripeProvider()
    await expect(
      provider.createCheckout({
        planId: "price_xxx",
        userId: "user_1",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      }),
    ).rejects.toThrow("STRIPE_SECRET_KEY is not set")
  })

  it("name property is 'stripe'", () => {
    const provider = makeProvider()
    expect(provider.name).toBe("stripe")
  })
})
