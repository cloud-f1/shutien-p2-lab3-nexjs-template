/**
 * Customer Portal pure helpers — E292.
 *
 * NO db / network imports — fully unit-testable. The server action
 * (`actions/billing.ts::createPortalSession`) imports these to build the
 * `stripe.billingPortal.sessions.create` arguments and to surface a clear
 * message for providers that have no hosted portal (e.g. ECPay).
 */

/** Returned (as an error) when a non-Stripe provider asks for a portal session. */
export const PORTAL_UNSUPPORTED_MESSAGE =
  "目前的金流商不支援帳務管理入口（Customer Portal）。請在應用程式內管理你的訂閱。"

/** Returned when no Stripe customer id can be resolved for the subscription. */
export const PORTAL_NO_CUSTOMER_MESSAGE =
  "找不到對應的金流客戶資料，無法開啟帳務管理入口。"

/**
 * Resolve the Stripe customer id from a subscription's `providerMeta`.
 *
 * The Stripe webhook stores the customer under `providerMeta.customer` (it may be
 * a bare id string or — defensively — a `{ id }` object). Returns `null` when no
 * usable id is present. This is the single source of truth for how checkout/webhook
 * stash the customer, so the portal redirect reads it the same way.
 */
export function resolveStripeCustomerId(
  providerMeta: Record<string, unknown> | null | undefined,
): string | null {
  if (!providerMeta) return null
  const raw = (providerMeta as { customer?: unknown }).customer
  if (typeof raw === "string" && raw.trim().length > 0) return raw
  if (raw && typeof raw === "object") {
    const id = (raw as { id?: unknown }).id
    if (typeof id === "string" && id.trim().length > 0) return id
  }
  return null
}

/**
 * Build the `return_url` the portal sends the browser back to after the user
 * finishes managing billing. Always points at the in-app billing surface.
 *
 * @param origin - The request origin (e.g. "https://app.example.com"). Trailing
 *   slashes are tolerated. Falls back to a relative path when origin is empty.
 */
export function buildPortalReturnUrl(origin: string | null | undefined): string {
  const path = "/dashboard/system"
  if (!origin) return path
  return `${origin.replace(/\/+$/, "")}${path}`
}
