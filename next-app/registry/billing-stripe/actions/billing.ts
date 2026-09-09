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
 * E370 — redirect URLs are built server-side from NEXT_PUBLIC_APP_URL, never
 * taken from the caller. This module is the fork-facing example: shipping the
 * unvalidated-URL shape here would propagate it into every fork that installs
 * the billing module.
 *
 * @param planId - The provider price ID (e.g. Stripe price_xxx)
 */
export async function createCheckoutSession(
  planId: string,
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    const provider = await resolvePaymentProvider()
    const result = await provider.createCheckout({
      planId,
      userId: session.user.id,
      successUrl: `${appUrl}/dashboard/system?billing=success`,
      cancelUrl: `${appUrl}/#pricing`,
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
