/**
 * Payment provider resolver — E231
 *
 * Reads BILLING_PROVIDER from the environment and returns the active
 * PaymentProvider instance.  Concrete adapters are lazy-imported so
 * only the selected one is bundled.
 *
 * Supported values:
 *   stripe     — default; Stripe adapter (E235)
 *   ecpay      — ECPay adapter (E236)
 *   tappay     — reserved; throws until implemented
 *   newebpay   — reserved; throws until implemented
 */

import type {
  OneTimePaymentGateway,
  PaymentProvider,
  SubscriptionGateway,
} from "./provider"

/** All provider keys recognized by this resolver. */
export type ProviderKey = "stripe" | "ecpay" | "tappay" | "newebpay"

/** Providers that are reserved but not yet implemented. */
const UNIMPLEMENTED_SLOTS = new Set<ProviderKey>(["tappay", "newebpay"])

/**
 * Returns the active PaymentProvider selected by the `BILLING_PROVIDER`
 * environment variable (default: `"stripe"`).
 *
 * @throws {Error} If BILLING_PROVIDER is set to an unimplemented slot
 *   ("tappay" or "newebpay") — throws with a descriptive message pointing
 *   to the relevant epic for tracking.
 * @throws {Error} If BILLING_PROVIDER is set to an unrecognized value.
 */
export async function resolvePaymentProvider(): Promise<PaymentProvider> {
  const key = (process.env.BILLING_PROVIDER ?? "stripe").toLowerCase() as ProviderKey

  if (UNIMPLEMENTED_SLOTS.has(key)) {
    throw new Error(
      `[billing] Provider "${key}" is reserved but not yet implemented. ` +
        `Concrete adapter will be added in a future epic (P57). ` +
        `Set BILLING_PROVIDER=stripe (default) or BILLING_PROVIDER=ecpay.`,
    )
  }

  switch (key) {
    case "stripe": {
      // Lazy import — Stripe adapter implemented in E235
      const { getStripeProvider } = await import("./providers/stripe")
      return getStripeProvider()
    }
    case "ecpay": {
      // Lazy import — ECPay adapter implemented in E236
      const { getEcpayProvider } = await import("./providers/ecpay")
      return getEcpayProvider()
    }
    default: {
      throw new Error(
        `[billing] Unknown BILLING_PROVIDER value: "${key}". ` +
          `Valid values: stripe (default), ecpay, tappay (reserved), newebpay (reserved).`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Capability-narrowed resolvers — Open/Closed + Interface Segregation (E327)
//
// Instead of resolving the fat PaymentProvider and discovering mid-request that a
// gateway can't do what you need, these entry points resolve the exact capability
// and FAIL FAST at resolve time with a descriptive error. Adding a gateway = one
// new case here; the checkout / settlement flow never changes (OCP).
// ---------------------------------------------------------------------------

/** Normalize the requested key (explicit arg wins; else env; else default). */
function normalizeKey(key?: ProviderKey): ProviderKey {
  if (key) return key.toLowerCase() as ProviderKey
  return resolveProviderKey()
}

/**
 * Resolve a gateway able to process a ONE-TIME hosted checkout + settlement
 * webhook (E327). Stripe, ECPay and NewebPay (藍新 MPG 幕前支付, one-time-only,
 * E329) all qualify today; TapPay is a reserved slot.
 *
 * @param key Optional explicit provider key; defaults to `BILLING_PROVIDER`.
 * @throws {Error} With a descriptive, capability-aware message for any gateway
 *   that cannot (yet) act as a one-time payment gateway.
 */
export async function resolveOneTime(
  key?: ProviderKey,
): Promise<OneTimePaymentGateway> {
  const k = normalizeKey(key)

  switch (k) {
    case "stripe": {
      const { getStripeProvider } = await import("./providers/stripe")
      return getStripeProvider()
    }
    case "ecpay": {
      const { getEcpayProvider } = await import("./providers/ecpay")
      return getEcpayProvider()
    }
    case "newebpay": {
      // 藍新 NewebPay MPG 幕前支付 — one-time-only gateway (E329).
      const { getNewebPayProvider } = await import("./providers/newebpay")
      return getNewebPayProvider()
    }
    case "tappay": {
      throw new Error(
        `[billing] Provider "tappay" is a reserved slot with no one-time adapter yet. ` +
          `Use ecpay or stripe.`,
      )
    }
    default: {
      throw new Error(
        `[billing] Unknown BILLING_PROVIDER value: "${k}". ` +
          `Valid one-time values: stripe, ecpay.`,
      )
    }
  }
}

/**
 * Resolve a gateway able to manage the recurring-SUBSCRIPTION lifecycle (E327).
 * Stripe and ECPay qualify. NewebPay (藍新) is a one-time-only gateway and can
 * NEVER be a subscription gateway, so it fails fast with a capability error (not
 * a "not implemented" error); TapPay is a reserved slot.
 *
 * @param key Optional explicit provider key; defaults to `BILLING_PROVIDER`.
 * @throws {Error} With a descriptive, capability-aware message.
 */
export async function resolveSubscription(
  key?: ProviderKey,
): Promise<SubscriptionGateway> {
  const k = normalizeKey(key)

  switch (k) {
    case "stripe": {
      const { getStripeProvider } = await import("./providers/stripe")
      return getStripeProvider()
    }
    case "ecpay": {
      const { getEcpayProvider } = await import("./providers/ecpay")
      return getEcpayProvider()
    }
    case "newebpay": {
      throw new Error(
        `[billing] "newebpay" (藍新) is a one-time-only gateway and cannot be resolved ` +
          `as a SubscriptionGateway. Use BILLING_PROVIDER=stripe or ecpay for subscriptions.`,
      )
    }
    case "tappay": {
      throw new Error(
        `[billing] Provider "tappay" is a reserved slot with no subscription adapter yet. ` +
          `Use stripe or ecpay for subscriptions.`,
      )
    }
    default: {
      throw new Error(
        `[billing] Unknown BILLING_PROVIDER value: "${k}". ` +
          `Valid subscription values: stripe, ecpay.`,
      )
    }
  }
}

/**
 * Returns the default provider key without instantiating a provider.
 * Useful for logging, metrics, and tests that only need the key.
 */
export function resolveProviderKey(): ProviderKey {
  const raw = process.env.BILLING_PROVIDER ?? "stripe"
  const key = raw.toLowerCase()

  const validKeys: ProviderKey[] = ["stripe", "ecpay", "tappay", "newebpay"]
  if (!validKeys.includes(key as ProviderKey)) {
    throw new Error(
      `[billing] Unknown BILLING_PROVIDER value: "${key}". ` +
        `Valid values: stripe (default), ecpay, tappay (reserved), newebpay (reserved).`,
    )
  }

  return key as ProviderKey
}
