"use server"
/**
 * Billing Server Actions — E235
 *
 * Provides the checkout action wired to the Pricing component.
 * Uses the PaymentProvider abstraction — defaults to Stripe.
 */

import { auth } from "@/lib/auth"
import { resolvePaymentProvider } from "@/lib/billing/resolver"

// ---------------------------------------------------------------------------
// createCheckoutSession — called from the Pricing component
// ---------------------------------------------------------------------------

export interface CreateCheckoutResult {
  success: boolean
  checkoutUrl?: string
  error?: string
}

/**
 * Create a hosted checkout session for the given plan.
 *
 * @param planId - The provider price ID (e.g. Stripe price_xxx)
 * @param successUrl - URL to redirect to after successful payment
 * @param cancelUrl - URL to redirect to if the user cancels
 */
export async function createCheckoutSession(
  planId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<CreateCheckoutResult> {
  // Require authentication
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "You must be signed in to subscribe." }
  }

  if (!planId) {
    return { success: false, error: "Invalid plan." }
  }

  try {
    const provider = await resolvePaymentProvider()
    const result = await provider.createCheckout({
      planId,
      userId: session.user.id,
      successUrl,
      cancelUrl,
      customerEmail: session.user.email ?? undefined,
    })

    return {
      success: true,
      checkoutUrl: result.checkoutUrl,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return { success: false, error: message }
  }
}
