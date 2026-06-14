/**
 * Stripe Webhook Route Handler — E235
 *
 * Receives raw Stripe webhook events, verifies signature, and processes them
 * with idempotency via payment_events.provider_event_id.
 *
 * Design decisions:
 * - Raw body reading: `request.text()` gives us the raw body string for sig verification
 * - Idempotency: insert payment_events row first; duplicate event_id = unique violation = skip
 * - Out-of-order tolerance: all subscription events re-fetch from Stripe API instead of
 *   trusting the event payload's potentially-stale subscription state
 *
 * Stripe SDK v22.x (API 2026-05-27.dahlia):
 * - Invoice.parent.subscription_details.subscription for the subscription ID
 * - Subscription no longer has current_period_end at top level
 */

import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getStripeProvider } from "@/lib/billing/providers/stripe"

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
    await processStripeEvent(event, rawBody)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"

    // Duplicate event — idempotency constraint; silently succeed
    if (message.includes("duplicate") || message.includes("unique")) {
      return NextResponse.json({ received: true, skipped: true })
    }

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
// ---------------------------------------------------------------------------

async function processStripeEvent(event: Stripe.Event, rawBody: string): Promise<void> {
  // Lazy import db to avoid module init in tests that don't need it
  const { db } = await import("@/lib/db")
  const { paymentEventsTable, subscriptionsTable } = await import("@/lib/schema")
  const { eq } = await import("drizzle-orm")

  // 4a. Idempotency: try to insert a payment_events row.
  // The UNIQUE constraint on provider_event_id prevents double-processing.
  await db.insert(paymentEventsTable).values({
    provider: "stripe",
    providerEventId: event.id,
    type: event.type,
    payload: JSON.parse(rawBody) as Record<string, unknown>,
    processedAt: null,
  })

  // 4b. Dispatch based on event type
  switch (event.type) {
    case "checkout.session.completed": {
      await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
        db,
        subscriptionsTable,
        eq,
      )
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

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice
      const subId = getInvoiceSubscriptionId(invoice)
      if (subId) {
        await refreshSubscriptionFromStripe(subId, db, subscriptionsTable, eq)
      }
      break
    }

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
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscriptionsTable: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eq: any,
): Promise<void> {
  if (session.mode !== "subscription" || !session.subscription) return

  const stripeSubId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id

  const userId = session.metadata?.userId
  const planId = session.metadata?.planId

  if (!userId || !planId) return

  // Re-fetch the subscription from Stripe for out-of-order tolerance
  const stripe = makeStripe()
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubId)

  // Upsert subscription row (insert + update on conflict)
  try {
    await db.insert(subscriptionsTable).values({
      userId,
      planId,
      provider: "stripe",
      providerSubId: stripeSubId,
      status: stripeSub.status,
      currentPeriodEnd: null,
      cancelAt: stripeSub.cancel_at ? new Date(stripeSub.cancel_at * 1000) : null,
      providerMeta: {
        cancel_at_period_end: stripeSub.cancel_at_period_end,
        customer: stripeSub.customer,
        stripe_status: stripeSub.status,
      },
    })
  } catch {
    // Row already exists — update it
    await refreshSubscriptionFromStripe(stripeSubId, db, subscriptionsTable, eq)
  }
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

  // Update existing subscription row (if it exists)
  await db
    .update(subscriptionsTable)
    .set({
      status: stripeSub.status,
      currentPeriodEnd: null,
      cancelAt: stripeSub.cancel_at ? new Date(stripeSub.cancel_at * 1000) : null,
      providerMeta: {
        cancel_at_period_end: stripeSub.cancel_at_period_end,
        customer: stripeSub.customer,
        stripe_status: stripeSub.status,
      },
      updatedAt: new Date(),
    })
    .where(eq(subscriptionsTable.providerSubId, stripeSubId))
}

// ---------------------------------------------------------------------------
// Prevent Next.js from buffering the body — we read it as text above
// This is the App Router equivalent of { api: { bodyParser: false } }
// ---------------------------------------------------------------------------
export const dynamic = "force-dynamic"
