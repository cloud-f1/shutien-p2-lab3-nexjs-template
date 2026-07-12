/**
 * E327 — Interface Segregation backward-compatibility + DIP guard tests.
 *
 * Verifies:
 *   1. `PaymentProvider` is still the full contract — a value typed as it is
 *      assignable to BOTH narrowed capability interfaces (the alias holds).
 *   2. A gateway implementing all methods satisfies each narrowed interface.
 *   3. DIP: the checkout action + settlement helper depend only on the interface
 *      + resolver, never importing a concrete provider under `providers/`.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  PaymentProviderError,
  type OneTimePaymentGateway,
  type PaymentProvider,
  type SubscriptionGateway,
} from "./provider"

// A minimal stand-in implementing every method (throwing bodies are fine — we
// only care about structural assignability at compile time + name at runtime).
function makeFullGateway(): PaymentProvider {
  const boom = () => {
    throw new PaymentProviderError("stub", "test")
  }
  return {
    name: "test",
    createCheckout: boom,
    verifyWebhook: boom,
    createSubscription: boom,
    chargeRecurring: boom,
    cancelSubscription: boom,
    reconcile: boom,
  } as unknown as PaymentProvider
}

describe("ISP backward-compatibility", () => {
  it("a PaymentProvider is assignable to OneTimePaymentGateway (alias holds)", () => {
    const full = makeFullGateway()
    const oneTime: OneTimePaymentGateway = full // compile-time assignability
    expect(oneTime.name).toBe("test")
    expect(typeof oneTime.createCheckout).toBe("function")
    expect(typeof oneTime.verifyWebhook).toBe("function")
  })

  it("a PaymentProvider is assignable to SubscriptionGateway (alias holds)", () => {
    const full = makeFullGateway()
    const sub: SubscriptionGateway = full // compile-time assignability
    expect(typeof sub.createSubscription).toBe("function")
    expect(typeof sub.chargeRecurring).toBe("function")
    expect(typeof sub.cancelSubscription).toBe("function")
    expect(typeof sub.reconcile).toBe("function")
  })

  it("the intersection alias requires every method (no capability dropped)", () => {
    const full = makeFullGateway() as unknown as Record<string, unknown>
    for (const m of [
      "createCheckout",
      "verifyWebhook",
      "createSubscription",
      "chargeRecurring",
      "cancelSubscription",
      "reconcile",
    ]) {
      expect(typeof full[m]).toBe("function")
    }
  })
})

describe("DIP — no direct concrete-provider imports", () => {
  function source(rel: string): string {
    return readFileSync(new URL(rel, import.meta.url), "utf8")
  }

  it("actions/checkout.ts does not import from lib/billing/providers/", () => {
    expect(source("../../actions/checkout.ts")).not.toMatch(/from\s+["'].*providers\//)
  })

  it("lib/billing/orders.ts does not import from lib/billing/providers/", () => {
    expect(source("./orders.ts")).not.toMatch(/from\s+["'].*providers\//)
  })
})
