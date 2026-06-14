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

import type { PaymentProvider } from "./provider"

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
