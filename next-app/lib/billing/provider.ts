/**
 * PaymentProvider abstraction — E231
 *
 * Defines the single interface every billing gateway must implement.
 * Concrete adapters (Stripe, ECPay, …) live in their own modules and
 * are never imported here — this file is the contract only.
 */

// ---------------------------------------------------------------------------
// Shared value types
// ---------------------------------------------------------------------------

/**
 * Billing interval values — the single source of truth.
 * lib/schema/billing.ts imports this array to build the `billing_interval` pgEnum,
 * so the DB enum and the TS type can never drift.
 */
export const BILLING_INTERVALS = ["month", "year", "week", "day"] as const

/** Billing interval for a plan. */
export type BillingInterval = (typeof BILLING_INTERVALS)[number]

/** Currency as ISO-4217 three-letter code (lower-case). */
export type Currency = string

/**
 * A subscription plan as seen by the application layer.
 * provider_price_id is the gateway's own price/product identifier.
 */
export interface Plan {
  id: string
  providerPriceId: string
  interval: BillingInterval
  /** Amount in the smallest currency unit (e.g. cents for USD). */
  amount: number
  currency: Currency
  active: boolean
}

/**
 * Subscription status values that mirror Stripe's lifecycle — the single source
 * of truth. lib/schema/billing.ts imports this array to build the
 * `subscription_status` pgEnum, so the DB enum and the TS type can never drift.
 * Providers MUST map to these.
 */
export const SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
] as const

/** Status values that mirror Stripe's lifecycle; providers MUST map to these. */
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

/**
 * A subscription as seen by the application layer.
 * provider_meta holds provider-specific state that doesn't fit the shared columns
 * (e.g. ECPay's ExecTimes / TotalSuccessTimes).
 */
export interface Subscription {
  id: string
  userId: string
  planId: string
  /** Which gateway owns this subscription (e.g. "stripe", "ecpay"). */
  provider: string
  /** The gateway's own subscription identifier. */
  providerSubId: string
  status: SubscriptionStatus
  /** Unix timestamp (seconds) when the current billing period ends. */
  currentPeriodEnd: number | null
  /** Unix timestamp (seconds) when the subscription will be canceled, if scheduled. */
  cancelAt: number | null
  /**
   * Provider-specific metadata in free-form shape.
   * ECPay: { exec_times, total_success_times, exec_status }
   * Stripe: { current_period_end }
   */
  providerMeta: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Operation argument / return types
// ---------------------------------------------------------------------------

/** Arguments to open a hosted-checkout session. */
export interface CreateCheckoutArgs {
  planId: string
  userId: string
  /** URL to redirect to after successful payment. */
  successUrl: string
  /** URL to redirect to if the user cancels. */
  cancelUrl: string
  /** Pre-fill customer e-mail if available. */
  customerEmail?: string
}

/** Result of opening a hosted-checkout session. */
export interface CheckoutResult {
  /** URL to redirect the user's browser to. */
  checkoutUrl: string
  /** Gateway session identifier (for reconciliation). */
  sessionId: string
}

/** Arguments to create a subscription directly (e.g. after checkout). */
export interface CreateSubscriptionArgs {
  planId: string
  userId: string
  /** Gateway-specific customer identifier (may already exist). */
  providerCustomerId: string
  /** Gateway-specific payment method identifier. */
  providerPaymentMethodId: string
}

/** Arguments to charge an existing subscription for its next period. */
export interface ChargeRecurringArgs {
  subscriptionId: string
  /** Gateway's own subscription identifier. */
  providerSubId: string
}

/** Result of a recurring charge attempt. */
export interface ChargeRecurringResult {
  success: boolean
  /** Gateway charge / invoice identifier. */
  chargeId: string
  /** Amount charged in the smallest currency unit. */
  amount: number
  currency: Currency
}

/** Arguments to cancel a subscription. */
export interface CancelSubscriptionArgs {
  subscriptionId: string
  providerSubId: string
  /**
   * When true, cancel at period end rather than immediately.
   * @default false
   */
  atPeriodEnd?: boolean
}

/** Result of webhook signature verification. */
export interface WebhookVerifyResult {
  /** True if signature is valid and payload is safe to process. */
  valid: boolean
  /** Parsed event type string (e.g. "invoice.payment_succeeded"). */
  eventType: string
  /** Raw parsed event payload from the gateway. */
  payload: unknown
}

/** Reconciliation summary returned by the provider's reconcile method. */
export interface ReconcileResult {
  /** Number of subscriptions checked. */
  checked: number
  /** Number of subscriptions whose status was updated. */
  updated: number
  /** Provider-specific details (optional). */
  details?: unknown
}

// ---------------------------------------------------------------------------
// PaymentProvider interface — every gateway must implement this
// ---------------------------------------------------------------------------

/**
 * The single contract for every payment gateway adapter.
 *
 * Rules for implementors:
 * - All methods are async.
 * - All errors must throw a `PaymentProviderError` (or a subclass).
 * - No method may import from another provider's module.
 */
export interface PaymentProvider {
  /** Human-readable provider name (e.g. "stripe", "ecpay"). */
  readonly name: string

  /**
   * Open a hosted checkout session and return the redirect URL.
   * Suitable for one-time payments and new subscription sign-ups.
   */
  createCheckout(args: CreateCheckoutArgs): Promise<CheckoutResult>

  /**
   * Create a subscription for an existing customer.
   * Used after payment method is already collected.
   */
  createSubscription(args: CreateSubscriptionArgs): Promise<Subscription>

  /**
   * Charge the next billing period for an active subscription.
   * ECPay calls this for each `ExecTimes` increment.
   */
  chargeRecurring(args: ChargeRecurringArgs): Promise<ChargeRecurringResult>

  /**
   * Cancel a subscription, immediately or at period end.
   */
  cancelSubscription(args: CancelSubscriptionArgs): Promise<Subscription>

  /**
   * Verify a gateway webhook signature and return the parsed event.
   * Must be idempotent — callers persist provider_event_id for deduplication.
   *
   * @param rawBody  Raw request body bytes (before any JSON parsing).
   * @param headers  Request headers map (for signature verification).
   */
  verifyWebhook(
    rawBody: Buffer | string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<WebhookVerifyResult>

  /**
   * Reconcile subscription statuses with the gateway's ground truth.
   * Call this from a scheduled job to catch missed webhooks.
   */
  reconcile(): Promise<ReconcileResult>
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

/** Thrown by any PaymentProvider method on failure. */
export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = "PaymentProviderError"
  }
}
