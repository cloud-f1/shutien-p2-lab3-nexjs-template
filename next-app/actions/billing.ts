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

import { headers } from "next/headers"

import { requireAuth } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"
import { db } from "@/lib/db"
import { subscriptionsTable } from "@/lib/schema"
import { resolvePaymentProvider, resolveProviderKey } from "@/lib/billing/resolver"
import { resolveOrCreatePlanId } from "@/lib/billing/plans"
import { getTierByPriceId } from "@/lib/billing/pricing"
import { getActiveSubscription } from "@/lib/billing/queries"
import {
  PORTAL_NO_CUSTOMER_MESSAGE,
  PORTAL_UNSUPPORTED_MESSAGE,
  buildPortalReturnUrl,
  resolveStripeCustomerId,
} from "@/lib/billing/portal-utils"

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
 * E370 — the post-payment redirect URLs are built HERE, server-side, from
 * NEXT_PUBLIC_APP_URL. They used to be plain parameters passed straight through
 * to the gateway: an authenticated caller could mint a genuine, correctly
 * branded checkout session whose `successUrl` pointed at a site they control,
 * then send that real gateway link to a victim. `actions/checkout.ts` (E327)
 * already built its URLs this way; this brings the subscription path in line.
 *
 * @param providerPriceId - The config tier's providerPriceId (Stripe price_xxx / ECPay PlanID)
 */
export async function createCheckoutSession(
  providerPriceId: string,
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

    // E370 — server-owned redirect targets; never caller-supplied.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    const successUrl = `${appUrl}/dashboard/system?billing=success`
    const cancelUrl = `${appUrl}/#pricing`

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

// ---------------------------------------------------------------------------
// createPortalSession — Stripe Customer Portal redirect (E292)
// ---------------------------------------------------------------------------

export interface CreatePortalResult {
  success: boolean
  /** The hosted Customer Portal URL to redirect the browser to (Stripe only). */
  url?: string
  error?: string
}

/**
 * Open a Stripe Customer Portal session for the current user so they can manage
 * their payment method + download invoices on Stripe's hosted page.
 *
 * Owner-scoped: resolves the customer id from the caller's OWN live subscription
 * (`providerMeta.customer`, written by the webhook) — never from a caller-supplied
 * value. Stripe-only: ECPay (綠界) has no equivalent hosted portal, so this returns
 * a clear "not supported" result and management stays in-app.
 *
 * On success the caller redirects with `window.location.href = url`.
 */
export async function createPortalSession(): Promise<CreatePortalResult> {
  const session = await requireAuth()
  if (!session?.user?.id) {
    return { success: false, error: "請先登入。" }
  }

  const providerKey = resolveProviderKey()
  if (providerKey !== "stripe") {
    // ECPay / reserved providers have no hosted Customer Portal.
    return { success: false, error: PORTAL_UNSUPPORTED_MESSAGE }
  }

  // Owner-scoped lookup — the customer id comes from the caller's own subscription.
  const active = await getActiveSubscription(session.user.id)
  if (!active) {
    return { success: false, error: "尚無使用中的方案，無法開啟帳務管理入口。" }
  }

  const customerId = resolveStripeCustomerId(
    active.subscription.providerMeta as Record<string, unknown> | null,
  )
  if (!customerId) {
    return { success: false, error: PORTAL_NO_CUSTOMER_MESSAGE }
  }

  try {
    const origin = (await headers()).get("origin")
    const returnUrl = buildPortalReturnUrl(origin)

    // The Stripe provider exposes the typed SDK client; the billingPortal API is
    // not part of the gateway-agnostic PaymentProvider contract, so we reach for
    // the Stripe adapter directly (it is the resolved provider here).
    const { getStripeClient } = await import("@/lib/billing/providers/stripe")
    const stripe = getStripeClient()
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })

    await logAudit({
      actorId: session.user.id,
      action: "billing.portal_opened",
      targetType: "subscription",
      targetId: active.subscription.id,
      metadata: { provider: providerKey, customerId },
    })

    return { success: true, url: portal.url }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return { success: false, error: `無法開啟帳務管理入口：${message}` }
  }
}
