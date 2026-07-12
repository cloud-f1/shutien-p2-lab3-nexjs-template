/**
 * Stripe Webhook Route Handler — E235 + E274.
 *
 * Receives raw Stripe webhook events, verifies signature, and processes them
 * with idempotency via payment_events.provider_event_id.
 *
 * E274 hardening:
 * - Plan-identity FK: writes the plans.id UUID (from metadata.planId, coerced via
 *   the DB when a legacy session stamped a providerPriceId) into subscriptions.planId.
 * - currentPeriodEnd: populated from the Stripe subscription items' current_period_end.
 * - Idempotency: payment_events insert uses onConflictDoNothing; the subscription
 *   upsert uses onConflictDoUpdate on the provider_sub_id UNIQUE constraint. Unique
 *   races are detected by SQLSTATE 23505 (NOT string-matching), via idempotency-utils.
 *
 * Stripe SDK v22.x (API 2026-05-27.dahlia):
 * - Invoice.parent.subscription_details.subscription for the subscription ID
 * - Subscription.items.data[i].current_period_end (no top-level field)
 */

import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getStripeProvider } from "@/lib/billing/providers/stripe"
import { isUniqueViolation } from "@/lib/billing/idempotency-utils"
import { stripePeriodEndDate, type StripeSubLike } from "@/lib/billing/period-utils"

// ---------------------------------------------------------------------------
// POST /api/billing/stripe/webhook
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Read raw body — must be done before any parsing for Stripe sig verification
  const rawBody = await request.text()

  // 2. Extract Stripe-Signature header
  const stripeSignature = request.headers.get("stripe-signature")
  if (!stripeSignature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  // 3. Verify webhook signature
  const provider = getStripeProvider()
  const verifyResult = await provider.verifyWebhook(rawBody, {
    "stripe-signature": stripeSignature,
  })

  if (!verifyResult.valid) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 })
  }

  const event = verifyResult.payload as Stripe.Event

  // 4. Idempotency check + dispatch
  try {
    const skipped = await processStripeEvent(event, rawBody)
    if (skipped) return NextResponse.json({ received: true, skipped: true })
  } catch {
    // Unexpected error — return 500 so Stripe retries (genuine transient failures)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ---------------------------------------------------------------------------
// Helper — get a Stripe client
// ---------------------------------------------------------------------------

function makeStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

// ---------------------------------------------------------------------------
// Helper — extract subscription ID from an Invoice object
// (Stripe v22+: parent.subscription_details.subscription)
// ---------------------------------------------------------------------------

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent
  if (!parent) return null
  if (parent.type !== "subscription_details") return null
  const subDetails = parent.subscription_details
  if (!subDetails) return null
  const sub = subDetails.subscription
  if (!sub) return null
  return typeof sub === "string" ? sub : sub.id
}

// ---------------------------------------------------------------------------
// Event dispatcher
// Returns true when the event was a duplicate (idempotency skip).
// ---------------------------------------------------------------------------

async function processStripeEvent(event: Stripe.Event, rawBody: string): Promise<boolean> {
  // Lazy import db to avoid module init in tests that don't need it
  const { db } = await import("@/lib/db")
  const { paymentEventsTable, subscriptionsTable } = await import("@/lib/schema")
  const { eq } = await import("drizzle-orm")

  // 4a. Idempotency: insert a payment_events row, no-op on duplicate event id.
  // onConflictDoNothing returns the inserted rows; an empty array => duplicate.
  const inserted = await db
    .insert(paymentEventsTable)
    .values({
      provider: "stripe",
      providerEventId: event.id,
      type: event.type,
      payload: JSON.parse(rawBody) as Record<string, unknown>,
      processedAt: null,
    })
    .onConflictDoNothing({ target: paymentEventsTable.providerEventId })
    .returning({ id: paymentEventsTable.id })

  if (inserted.length === 0) {
    // Already processed — idempotent skip.
    return true
  }

  // 4b. Dispatch based on event type
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      // E327: one-time product purchases use mode "payment" — settle the order.
      // Subscriptions keep the existing mode "subscription" path untouched.
      if (session.mode === "payment") {
        await handleOneTimePaid(session, event.id)
      } else {
        await handleCheckoutCompleted(session, db, subscriptionsTable)
      }
      break
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      // Out-of-order tolerance: re-fetch from Stripe instead of trusting event payload
      const sub = event.data.object as Stripe.Subscription
      await refreshSubscriptionFromStripe(sub.id, db, subscriptionsTable, eq)
      break
    }

    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice
      const subId = getInvoiceSubscriptionId(invoice)
      if (subId) {
        await refreshSubscriptionFromStripe(subId, db, subscriptionsTable, eq)
      }
      break
    }

    default:
      // Unhandled event type — acknowledged but not processed
      break
  }

  // 4c. Mark event as processed
  await db
    .update(paymentEventsTable)
    .set({ processedAt: new Date() })
    .where(eq(paymentEventsTable.providerEventId, event.id))

  return false
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

/**
 * E327 — settle a one-time product order from a Stripe `mode: "payment"`
 * checkout session. The order id rides `metadata.orderId` (stamped by the
 * provider's one-time branch). Delegates the pending→paid transition +
 * idempotency to the shared settleOrder() helper.
 */
async function handleOneTimePaid(
  session: Stripe.Checkout.Session,
  eventId: string,
): Promise<void> {
  const orderId = session.metadata?.orderId
  if (!orderId) return

  const { settleOrder } = await import("@/lib/billing/orders")
  await settleOrder({
    provider: "stripe",
    providerEventId: `order:${eventId}`,
    eventType: "checkout.session.completed",
    orderId,
    providerOrderId: session.id,
    payload: { sessionId: session.id, mode: session.mode },
    // A completed Checkout Session with payment_status "paid" (or "no_payment_required").
    success: session.payment_status !== "unpaid",
  })
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscriptionsTable: any,
): Promise<void> {
  if (session.mode !== "subscription" || !session.subscription) return

  const stripeSubId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id

  const userId = session.metadata?.userId
  const metadataPlanId = session.metadata?.planId

  if (!userId || !metadataPlanId) return

  // E274 plan-identity FK fix: coerce metadata.planId to a real plans.id UUID.
  const { coercePlanUuid } = await import("@/lib/billing/plans")
  const planId = await coercePlanUuid(metadataPlanId)
  if (!planId) return // cannot satisfy the FK — skip rather than crash

  // Re-fetch the subscription from Stripe for out-of-order tolerance + period end
  const stripe = makeStripe()
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubId)
  const periodEnd = stripePeriodEndDate(stripeSub as unknown as StripeSubLike)

  // E274 idempotent upsert: insert + update on the provider_sub_id UNIQUE conflict.
  await db
    .insert(subscriptionsTable)
    .values({
      userId,
      planId,
      provider: "stripe",
      providerSubId: stripeSubId,
      status: stripeSub.status,
      currentPeriodEnd: periodEnd,
      cancelAt: stripeSub.cancel_at ? new Date(stripeSub.cancel_at * 1000) : null,
      providerMeta: {
        cancel_at_period_end: stripeSub.cancel_at_period_end,
        customer: stripeSub.customer,
        stripe_status: stripeSub.status,
        current_period_end: periodEnd ? Math.floor(periodEnd.getTime() / 1000) : null,
      },
    })
    .onConflictDoUpdate({
      target: subscriptionsTable.providerSubId,
      set: {
        planId,
        status: stripeSub.status,
        currentPeriodEnd: periodEnd,
        cancelAt: stripeSub.cancel_at ? new Date(stripeSub.cancel_at * 1000) : null,
        providerMeta: {
          cancel_at_period_end: stripeSub.cancel_at_period_end,
          customer: stripeSub.customer,
          stripe_status: stripeSub.status,
          current_period_end: periodEnd ? Math.floor(periodEnd.getTime() / 1000) : null,
        },
        updatedAt: new Date(),
      },
    })
}

async function refreshSubscriptionFromStripe(
  stripeSubId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscriptionsTable: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eq: any,
): Promise<void> {
  const stripe = makeStripe()

  // Re-fetch from Stripe — out-of-order tolerance
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubId)
  const periodEnd = stripePeriodEndDate(stripeSub as unknown as StripeSubLike)

  // Update existing subscription row (if it exists)
  await db
    .update(subscriptionsTable)
    .set({
      status: stripeSub.status,
      currentPeriodEnd: periodEnd,
      cancelAt: stripeSub.cancel_at ? new Date(stripeSub.cancel_at * 1000) : null,
      providerMeta: {
        cancel_at_period_end: stripeSub.cancel_at_period_end,
        customer: stripeSub.customer,
        stripe_status: stripeSub.status,
        current_period_end: periodEnd ? Math.floor(periodEnd.getTime() / 1000) : null,
      },
      updatedAt: new Date(),
    })
    .where(eq(subscriptionsTable.providerSubId, stripeSubId))
}

// Re-export for tests + future callers — detect PG unique violations by code.
export { isUniqueViolation }

// ---------------------------------------------------------------------------
// Prevent Next.js from buffering the body — we read it as text above
// This is the App Router equivalent of { api: { bodyParser: false } }
// ---------------------------------------------------------------------------
export const dynamic = "force-dynamic"
