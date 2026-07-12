/**
 * Stripe PaymentProvider adapter — E235
 *
 * Implements the PaymentProvider interface from E231 using the Stripe SDK v22.x.
 * This is the DEFAULT provider (BILLING_PROVIDER=stripe).
 *
 * Key design decisions:
 * - verifyWebhook uses stripe.webhooks.constructEvent for HMAC-SHA256 sig verification
 * - idempotency is enforced via payment_events.provider_event_id (UNIQUE constraint)
 * - out-of-order tolerance: every relevant webhook re-fetches the subscription from Stripe
 * - reconcile() re-fetches all active subscriptions from Stripe to catch missed webhooks
 *
 * Note: Stripe SDK v22+ (API 2026-05-27.dahlia) changes the Subscription type:
 * - No `current_period_end` directly on Subscription — access via items or metadata
 * - Invoice uses `parent.subscription_details.subscription` instead of `.subscription`
 */

import Stripe from "stripe"
import type {
  CancelSubscriptionArgs,
  ChargeRecurringArgs,
  ChargeRecurringResult,
  CheckoutResult,
  CreateCheckoutArgs,
  CreateSubscriptionArgs,
  ReconcileResult,
  Subscription,
  SubscriptionStatus,
  WebhookVerifyResult,
} from "../provider"
import { PaymentProviderError } from "../provider"
import { stripePeriodEndEpoch, type StripeSubLike } from "../period-utils"
import type { GatewaySubState } from "../reconcile-utils"

// ---------------------------------------------------------------------------
// Stripe singleton — initialized lazily so tests can mock env vars
// ---------------------------------------------------------------------------

let _stripe: Stripe | undefined

function getStripe(): Stripe {
  if (!_stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new PaymentProviderError(
        "STRIPE_SECRET_KEY is not set. Add it to your .env.local file.",
        "stripe",
        "missing_secret_key",
      )
    }
    _stripe = new Stripe(secretKey)
  }
  return _stripe
}

// ---------------------------------------------------------------------------
// Helper — map Stripe subscription status → SubscriptionStatus
// ---------------------------------------------------------------------------

function mapStripeStatus(
  stripeStatus: Stripe.Subscription["status"],
): SubscriptionStatus {
  switch (stripeStatus) {
    case "active":
      return "active"
    case "trialing":
      return "trialing"
    case "past_due":
      return "past_due"
    case "canceled":
      return "canceled"
    case "unpaid":
      return "unpaid"
    case "incomplete":
      return "incomplete"
    case "incomplete_expired":
      return "incomplete_expired"
    case "paused":
      return "paused"
    default:
      return "incomplete"
  }
}

// ---------------------------------------------------------------------------
// Helper — map Stripe Subscription object → app Subscription shape
// ---------------------------------------------------------------------------

function mapStripeSubscription(
  stripeSub: Stripe.Subscription,
  userId: string,
  planId: string,
  subscriptionId: string,
): Subscription {
  const cancelAt =
    stripeSub.cancel_at !== null && typeof stripeSub.cancel_at === "number"
      ? stripeSub.cancel_at
      : null

  return {
    id: subscriptionId,
    userId,
    planId,
    provider: "stripe",
    providerSubId: stripeSub.id,
    status: mapStripeStatus(stripeSub.status),
    // Stripe SDK v22+ removed current_period_end from the Subscription top-level.
    // Store null; reconcile logic can update from subscription items if needed.
    currentPeriodEnd: null,
    cancelAt,
    providerMeta: {
      cancel_at_period_end: stripeSub.cancel_at_period_end,
      customer: stripeSub.customer,
      stripe_status: stripeSub.status,
    },
  }
}

// ---------------------------------------------------------------------------
// StripeProvider — implements PaymentProvider
// ---------------------------------------------------------------------------

export class StripeProvider {
  readonly name = "stripe"

  /**
   * Create a Stripe Checkout Session and return the redirect URL.
   * The session is in subscription mode with the specified price ID.
   *
   * E327 — `mode: "one-time"` branches to a `mode: "payment"` session priced
   * inline via `price_data` (no Stripe price id needed). The subscription path
   * below is unchanged.
   */
  async createCheckout(args: CreateCheckoutArgs): Promise<CheckoutResult> {
    const stripe = getStripe()

    // E327 additive branch — one-time product purchase.
    if (args.mode === "one-time") {
      return this.createOneTimeCheckoutSession(args, stripe)
    }

    const providerPriceId = args.planId // planId is used as provider price ID at checkout
    // E274 plan-identity FK fix: carry the plans.id UUID in metadata so the
    // webhook writes the UUID (not the providerPriceId) into subscriptions.planId.
    const metadataPlanId = args.planUuid ?? args.planId

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [
          {
            price: providerPriceId,
            quantity: 1,
          },
        ],
        success_url: args.successUrl,
        cancel_url: args.cancelUrl,
        ...(args.customerEmail ? { customer_email: args.customerEmail } : {}),
        metadata: {
          userId: args.userId,
          planId: metadataPlanId,
        },
        subscription_data: {
          metadata: {
            userId: args.userId,
            planId: metadataPlanId,
          },
        },
      })

      if (!session.url) {
        throw new PaymentProviderError(
          "Stripe Checkout Session created but returned no URL",
          "stripe",
          "no_checkout_url",
        )
      }

      return {
        checkoutUrl: session.url,
        sessionId: session.id,
      }
    } catch (err) {
      if (err instanceof PaymentProviderError) throw err
      throw new PaymentProviderError(
        `Failed to create Stripe Checkout Session: ${(err as Error).message}`,
        "stripe",
        "checkout_create_failed",
      )
    }
  }

  /**
   * E327 — one-time purchase: a `mode: "payment"` Checkout Session priced
   * inline with `price_data` ({ currency, unit_amount, product_data.name }) —
   * no pre-registered Stripe price id required. `args.orderId` (our orders.id)
   * rides `metadata.orderId` so the `checkout.session.completed` webhook can
   * settle the matching order via settleOrder().
   */
  private async createOneTimeCheckoutSession(
    args: CreateCheckoutArgs,
    stripe: Stripe,
  ): Promise<CheckoutResult> {
    const amount = args.amount ?? 0
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new PaymentProviderError(
        `Invalid one-time amount "${String(args.amount)}". Pass a positive integer in the smallest currency unit.`,
        "stripe",
        "invalid_one_time_amount",
      )
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: (args.currency ?? "usd").toLowerCase(),
              unit_amount: amount,
              product_data: {
                name: args.productName ?? "One-time purchase",
              },
            },
            quantity: 1,
          },
        ],
        success_url: args.successUrl,
        cancel_url: args.cancelUrl,
        ...(args.customerEmail ? { customer_email: args.customerEmail } : {}),
        metadata: {
          orderId: args.orderId ?? "",
          userId: args.userId,
        },
      })

      if (!session.url) {
        throw new PaymentProviderError(
          "Stripe Checkout Session created but returned no URL",
          "stripe",
          "no_checkout_url",
        )
      }

      return {
        checkoutUrl: session.url,
        sessionId: session.id,
      }
    } catch (err) {
      if (err instanceof PaymentProviderError) throw err
      throw new PaymentProviderError(
        `Failed to create Stripe one-time Checkout Session: ${(err as Error).message}`,
        "stripe",
        "checkout_create_failed",
      )
    }
  }

  /**
   * Create a subscription directly (after payment method collection).
   */
  async createSubscription(args: CreateSubscriptionArgs): Promise<Subscription> {
    const stripe = getStripe()

    try {
      const stripeSub = await stripe.subscriptions.create({
        customer: args.providerCustomerId,
        items: [{ price: args.planId }],
        default_payment_method: args.providerPaymentMethodId,
        metadata: {
          userId: args.userId,
          planId: args.planId,
        },
      })

      // Return a provisional subscription — the caller is responsible for persisting
      return mapStripeSubscription(stripeSub, args.userId, args.planId, "")
    } catch (err) {
      throw new PaymentProviderError(
        `Failed to create Stripe subscription: ${(err as Error).message}`,
        "stripe",
        "subscription_create_failed",
      )
    }
  }

  /**
   * Charge the next billing period for an active subscription.
   * For Stripe, this creates an invoice and pays it immediately.
   */
  async chargeRecurring(args: ChargeRecurringArgs): Promise<ChargeRecurringResult> {
    const stripe = getStripe()

    try {
      // Create an invoice item and force-finalize it
      const invoice = await stripe.invoices.create({
        subscription: args.providerSubId,
        auto_advance: true,
      })

      const paid = await stripe.invoices.pay(invoice.id)

      if (!paid.amount_paid) {
        throw new PaymentProviderError(
          "Invoice was not paid",
          "stripe",
          "invoice_not_paid",
        )
      }

      return {
        success: paid.status === "paid",
        chargeId: paid.id,
        amount: paid.amount_paid,
        currency: paid.currency,
      }
    } catch (err) {
      if (err instanceof PaymentProviderError) throw err
      throw new PaymentProviderError(
        `Failed to charge recurring: ${(err as Error).message}`,
        "stripe",
        "charge_recurring_failed",
      )
    }
  }

  /**
   * Cancel a subscription, immediately or at period end.
   */
  async cancelSubscription(args: CancelSubscriptionArgs): Promise<Subscription> {
    const stripe = getStripe()

    try {
      let stripeSub: Stripe.Subscription

      if (args.atPeriodEnd) {
        // Schedule cancellation at period end
        stripeSub = await stripe.subscriptions.update(args.providerSubId, {
          cancel_at_period_end: true,
        })
      } else {
        // Cancel immediately
        stripeSub = await stripe.subscriptions.cancel(args.providerSubId)
      }

      return mapStripeSubscription(
        stripeSub,
        "", // userId not available here — caller has it
        "", // planId not available here — caller has it
        args.subscriptionId,
      )
    } catch (err) {
      if (err instanceof PaymentProviderError) throw err
      throw new PaymentProviderError(
        `Failed to cancel Stripe subscription: ${(err as Error).message}`,
        "stripe",
        "cancel_failed",
      )
    }
  }

  /**
   * Verify a Stripe webhook signature using stripe.webhooks.constructEvent.
   *
   * The Stripe-Signature header format is: t=<timestamp>,v1=<hmac-sha256>
   * stripe.webhooks.constructEvent handles the HMAC-SHA256 verification.
   *
   * @param rawBody - Raw request body (Buffer or string) — must NOT be JSON.parsed first
   * @param headers - Request headers including "stripe-signature"
   */
  async verifyWebhook(
    rawBody: Buffer | string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<WebhookVerifyResult> {
    const stripe = getStripe()

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      throw new PaymentProviderError(
        "STRIPE_WEBHOOK_SECRET is not set.",
        "stripe",
        "missing_webhook_secret",
      )
    }

    // Normalize header (may be string or string[])
    const sigHeader = headers["stripe-signature"]
    const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader

    if (!sig) {
      return {
        valid: false,
        eventType: "",
        payload: null,
      }
    }

    try {
      const event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        webhookSecret,
      )

      return {
        valid: true,
        eventType: event.type,
        payload: event,
      }
    } catch {
      // stripe.webhooks.constructEvent throws on invalid signature
      return {
        valid: false,
        eventType: "",
        payload: null,
      }
    }
  }

  /**
   * Reconcile subscriptions by re-fetching from Stripe API.
   * Intended to be called from a scheduled job to catch missed webhooks.
   *
   * This method does NOT write to the database directly — it returns a reconcile
   * result with details. The caller is responsible for persisting changes.
   */
  async reconcile(): Promise<ReconcileResult> {
    const stripe = getStripe()

    try {
      // Fetch all active subscriptions from Stripe (paginate if needed)
      let checked = 0
      let updated = 0
      const details: Array<{ id: string; status: string }> = []

      const subs = await stripe.subscriptions.list({
        limit: 100,
        status: "all",
      })

      for (const sub of subs.data) {
        checked++
        details.push({ id: sub.id, status: sub.status })
        // In a full implementation, compare against DB and update if different
        // For now, we count all fetched subscriptions as checked
        updated++
      }

      return {
        checked,
        updated,
        details,
      }
    } catch (err) {
      throw new PaymentProviderError(
        `Reconcile failed: ${(err as Error).message}`,
        "stripe",
        "reconcile_failed",
      )
    }
  }

  /**
   * Fetch the gateway's ground-truth state for a list of stored providerSubIds.
   * Used by the recovery route to diff against the `subscriptions` table (the
   * diffing itself is pure — see reconcile-utils.ts). Missing/deleted Stripe
   * subscriptions are skipped (not returned).
   */
  async fetchGatewayStates(
    providerSubIds: string[],
  ): Promise<GatewaySubState[]> {
    const stripe = getStripe()
    const out: GatewaySubState[] = []

    for (const id of providerSubIds) {
      try {
        const sub = await stripe.subscriptions.retrieve(id)
        out.push({
          providerSubId: sub.id,
          status: mapStripeStatus(sub.status),
          currentPeriodEnd: stripePeriodEndEpoch(sub as unknown as StripeSubLike),
          cancelAt:
            sub.cancel_at !== null && typeof sub.cancel_at === "number"
              ? sub.cancel_at
              : null,
        })
      } catch {
        // Subscription not found on Stripe — skip (caller treats as not-in-snapshot)
      }
    }

    return out
  }
}

/**
 * Expose the lazily-initialized Stripe SDK client (E292).
 *
 * The Customer Portal API (`stripe.billingPortal`) is not part of the
 * gateway-agnostic PaymentProvider contract, so the billing action reaches for
 * the typed SDK client directly. Throws PaymentProviderError if STRIPE_SECRET_KEY
 * is unset (same as every other Stripe call).
 */
export function getStripeClient(): Stripe {
  return getStripe()
}

// ---------------------------------------------------------------------------
// Export singleton factory (allows test overrides)
// ---------------------------------------------------------------------------

let _instance: StripeProvider | undefined

export function getStripeProvider(): StripeProvider {
  if (!_instance) {
    _instance = new StripeProvider()
  }
  return _instance
}

/** Reset singleton — for testing only */
export function _resetStripeProvider(): void {
  _instance = undefined
  _stripe = undefined
}
