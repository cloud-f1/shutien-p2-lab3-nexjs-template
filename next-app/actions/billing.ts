"use server"
/**
 * Billing Server Actions — E235 + E274 money-path.
 *
 * Thin wrappers: auth + audit + DB FK resolution, delegating gateway calls to the
 * PaymentProvider abstraction (default Stripe). All pure logic lives in db-free
 * *-utils.ts modules.
 */

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"

import { requireAuth } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"
import { db } from "@/lib/db"
import { subscriptionsTable } from "@/lib/schema"
import { resolvePaymentProvider, resolveProviderKey } from "@/lib/billing/resolver"
import { resolveOrCreatePlanId } from "@/lib/billing/plans"
import { getTierByPriceId } from "@/lib/billing/pricing"

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
 * @param providerPriceId - The config tier's providerPriceId (Stripe price_xxx / ECPay PlanID)
 * @param successUrl - URL to redirect to after successful payment
 * @param cancelUrl - URL to redirect to if the user cancels
 */
export async function createCheckoutSession(
  providerPriceId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<CreateCheckoutResult> {
  // Require authentication — redirects to /login if unauthenticated.
  const session = await requireAuth()
  if (!session?.user?.id) {
    return { success: false, error: "請先登入後再訂閱。" }
  }

  if (!providerPriceId) {
    return { success: false, error: "無效的方案。" }
  }

  const tier = getTierByPriceId(providerPriceId)
  if (!tier || !tier.providerPriceId) {
    return { success: false, error: "找不到對應的方案，請重新整理後再試。" }
  }

  try {
    // E274 plan-identity FK fix: resolve (or create) the plans.id UUID so the
    // gateway session metadata carries the UUID, and the webhook writes it into
    // subscriptions.planId (a UUID FK), never the providerPriceId string.
    const planUuid = await resolveOrCreatePlanId(providerPriceId)

    const providerKey = resolveProviderKey()
    // ECPay's createCheckout expects "interval:amount:description"; Stripe uses the
    // raw price id. Build the gateway planId per provider from the config tier.
    const gatewayPlanId =
      providerKey === "ecpay"
        ? `${tier.interval}:${tier.monthlyPrice}:${tier.name}`
        : tier.providerPriceId

    const provider = await resolvePaymentProvider()
    const result = await provider.createCheckout({
      planId: gatewayPlanId,
      planUuid,
      userId: session.user.id,
      successUrl,
      cancelUrl,
      customerEmail: session.user.email ?? undefined,
    })

    await logAudit({
      actorId: session.user.id,
      action: "billing.checkout_started",
      targetType: "plan",
      targetId: planUuid,
      metadata: { provider: providerKey, providerPriceId, sessionId: result.sessionId },
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

// ---------------------------------------------------------------------------
// cancelSubscription — called from the BillingPanel (gated behind ConfirmDialog)
// ---------------------------------------------------------------------------

export interface CancelSubscriptionResult {
  success: boolean
  error?: string
}

/**
 * Cancel the current user's subscription. Owner-scoped: only the subscription's
 * owner may cancel it. Cancels at period end by default so the user keeps access
 * until the paid period ends. Reflects the new status in the DB + revalidates the
 * billing surface.
 *
 * @param subscriptionId - The subscriptions.id UUID to cancel.
 * @param immediate - When true, cancel immediately rather than at period end.
 */
export async function cancelSubscription(
  subscriptionId: string,
  immediate = false,
): Promise<CancelSubscriptionResult> {
  const session = await requireAuth()
  if (!session?.user?.id) {
    return { success: false, error: "請先登入。" }
  }

  if (!subscriptionId) {
    return { success: false, error: "無效的訂閱。" }
  }

  // Owner-scoped lookup — never cancel a subscription you don't own.
  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.id, subscriptionId))
    .limit(1)

  if (!sub || sub.userId !== session.user.id) {
    return { success: false, error: "找不到訂閱或你沒有權限取消。" }
  }

  if (sub.status === "canceled") {
    return { success: false, error: "此訂閱已取消。" }
  }

  try {
    const provider = await resolvePaymentProvider()
    const result = await provider.cancelSubscription({
      subscriptionId: sub.id,
      providerSubId: sub.providerSubId,
      atPeriodEnd: !immediate,
    })

    // Persist the resulting status. At-period-end cancellations stay "active"
    // with a cancelAt set; immediate cancellations flip to "canceled".
    await db
      .update(subscriptionsTable)
      .set({
        status: result.status,
        cancelAt: result.cancelAt ? new Date(result.cancelAt * 1000) : sub.cancelAt,
        updatedAt: new Date(),
      })
      .where(eq(subscriptionsTable.id, sub.id))

    await logAudit({
      actorId: session.user.id,
      action: "billing.subscription_canceled",
      targetType: "subscription",
      targetId: sub.id,
      metadata: { provider: sub.provider, immediate, newStatus: result.status },
    })

    revalidatePath("/dashboard/system")
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return { success: false, error: `取消訂閱失敗：${message}` }
  }
}
