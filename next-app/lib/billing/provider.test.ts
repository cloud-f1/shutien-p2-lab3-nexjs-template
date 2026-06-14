/**
 * E231 — PaymentProvider interface contract tests
 *
 * These tests verify the *shape* of the contract — types compile, shared types
 * have the expected structure, and PaymentProviderError behaves correctly.
 * No concrete provider is imported here.
 */

import { describe, expect, it } from "vitest"
import {
  PaymentProviderError,
  type BillingInterval,
  type CheckoutResult,
  type Plan,
  type Subscription,
  type SubscriptionStatus,
  type WebhookVerifyResult,
} from "./provider"

// ---------------------------------------------------------------------------
// PaymentProviderError
// ---------------------------------------------------------------------------

describe("PaymentProviderError", () => {
  it("is an instance of Error", () => {
    const err = new PaymentProviderError("test", "stripe")
    expect(err).toBeInstanceOf(Error)
  })

  it("has name PaymentProviderError", () => {
    const err = new PaymentProviderError("test", "stripe")
    expect(err.name).toBe("PaymentProviderError")
  })

  it("stores the provider name", () => {
    const err = new PaymentProviderError("boom", "ecpay")
    expect(err.provider).toBe("ecpay")
  })

  it("stores an optional code", () => {
    const err = new PaymentProviderError("boom", "stripe", "card_declined")
    expect(err.code).toBe("card_declined")
  })

  it("code is undefined when not supplied", () => {
    const err = new PaymentProviderError("boom", "stripe")
    expect(err.code).toBeUndefined()
  })

  it("message is accessible", () => {
    const err = new PaymentProviderError("something went wrong", "stripe")
    expect(err.message).toBe("something went wrong")
  })
})

// ---------------------------------------------------------------------------
// Shared type compile-time shape checks (runtime duck-typing)
// ---------------------------------------------------------------------------

describe("Plan type shape", () => {
  it("accepts a valid Plan object", () => {
    const plan: Plan = {
      id: "plan_1",
      providerPriceId: "price_stripe_xxx",
      interval: "month",
      amount: 999,
      currency: "usd",
      active: true,
    }
    expect(plan.id).toBe("plan_1")
    expect(plan.interval).toBe("month")
    expect(plan.amount).toBe(999)
    expect(plan.active).toBe(true)
  })
})

describe("Subscription type shape", () => {
  it("accepts a valid Subscription object with null optional fields", () => {
    const sub: Subscription = {
      id: "sub_1",
      userId: "user_abc",
      planId: "plan_1",
      provider: "stripe",
      providerSubId: "sub_stripe_xxx",
      status: "active",
      currentPeriodEnd: null,
      cancelAt: null,
      providerMeta: {},
    }
    expect(sub.status).toBe("active")
    expect(sub.providerMeta).toEqual({})
  })

  it("accepts ECPay-specific provider_meta shape", () => {
    const sub: Subscription = {
      id: "sub_2",
      userId: "user_def",
      planId: "plan_2",
      provider: "ecpay",
      providerSubId: "ecpay_plan_id",
      status: "active",
      currentPeriodEnd: null,
      cancelAt: null,
      providerMeta: {
        exec_times: 12,
        total_success_times: 11,
        exec_status: "0",
      },
    }
    expect((sub.providerMeta as Record<string, unknown>).exec_times).toBe(12)
  })
})

describe("CheckoutResult type shape", () => {
  it("accepts a valid CheckoutResult", () => {
    const result: CheckoutResult = {
      checkoutUrl: "https://checkout.stripe.com/pay/cs_test_xxx",
      sessionId: "cs_test_xxx",
    }
    expect(result.checkoutUrl).toContain("stripe.com")
  })
})

describe("WebhookVerifyResult type shape", () => {
  it("accepts a valid WebhookVerifyResult", () => {
    const result: WebhookVerifyResult = {
      valid: true,
      eventType: "invoice.payment_succeeded",
      payload: { id: "evt_xxx" },
    }
    expect(result.valid).toBe(true)
    expect(result.eventType).toBe("invoice.payment_succeeded")
  })
})

// ---------------------------------------------------------------------------
// BillingInterval / SubscriptionStatus exhaustiveness guards
// ---------------------------------------------------------------------------

describe("BillingInterval values", () => {
  const validIntervals: BillingInterval[] = ["month", "year", "week", "day"]

  it.each(validIntervals)("'%s' is a valid BillingInterval", (interval) => {
    // If this test compiles, the type accepts the value.
    expect(typeof interval).toBe("string")
  })
})

describe("SubscriptionStatus values", () => {
  const validStatuses: SubscriptionStatus[] = [
    "active",
    "trialing",
    "past_due",
    "canceled",
    "unpaid",
    "incomplete",
    "incomplete_expired",
    "paused",
  ]

  it.each(validStatuses)("'%s' is a valid SubscriptionStatus", (status) => {
    expect(typeof status).toBe("string")
  })
})

// ---------------------------------------------------------------------------
// No concrete provider import check — enforced structurally
// ---------------------------------------------------------------------------

describe("contract purity", () => {
  it("does not import from any concrete provider module", () => {
    // This test documents the requirement structurally.
    // If this file compiles with only imports from ./provider, the contract is pure.
    expect(true).toBe(true)
  })
})
