"use server"
// stop-verifier:public-action — 一次性購買允許「訪客結帳」(no session)。此為刻意的
// pre-auth 端點：登入非必要，但所有 buyer 輸入都在 server 端經 Zod 驗證 (checkout-schema.ts)，
// 且金額/幣別一律以 DB 的 products 為準，不信任 client。
/**
 * Unified one-time checkout — E327.
 *
 * Server Action `createOneTimeCheckout` (built via the defineAction factory in
 * PUBLIC mode so guests may buy). Flow:
 *   1. Zod-validate the payload (productSlug, email, name?, gateway?).
 *   2. Load the active product from the DB (amount/currency are server-owned).
 *   3. Create a `pending` order (guest → user_id null; logged-in → linked).
 *   4. Resolve the ONE-TIME gateway via the resolver (DIP — never import a
 *      concrete provider here) and open a hosted checkout.
 *   5. Return `{ redirectUrl }` (Stripe hosted session) or `{ formHtml }` (ECPay
 *      auto-submit form) so the client can redirect / submit.
 *
 * Settlement happens later in the gateway webhook routes via `settleOrder()`.
 */

import { db } from "@/lib/db"
import { ordersTable, productsTable } from "@/lib/schema"
import { and, eq } from "drizzle-orm"

import { defineAction } from "@/lib/define-action"
import { normalizeUtm, isEmptyUtm } from "@/lib/analytics/funnel-utils"
import {
  oneTimeCheckoutSchema,
  type OneTimeCheckoutInput,
} from "@/lib/billing/checkout-schema"
import { resolveOneTime, resolveProviderKey, type ProviderKey } from "@/lib/billing/resolver"
import { orderAccessToken } from "@/lib/billing/order-token"

/** Business-data payload returned on a successful checkout. */
type CheckoutData = { orderId: string; redirectUrl?: string; formHtml?: string }

/** Result of opening a unified one-time checkout. */
export type OneTimeCheckoutResult = ({ ok: true } & CheckoutData) | { error: string }

const DATA_HTML_PREFIX = "data:text/html;charset=utf-8,"

const createOneTimeCheckoutAction = defineAction<typeof oneTimeCheckoutSchema, CheckoutData>({
  public: true,
  // E370 — stated explicitly even though it matches the factory default, so the
  // one endpoint reachable with NO session shows its throttle at the call site.
  // Unlimited anonymous calls here meant unbounded `orders` rows (pending, with
  // an attacker-chosen customerEmail), burnt gateway session quota, and one
  // logAudit write per hit.
  rateLimit: { limit: 10, windowMs: 60_000 },
  schema: oneTimeCheckoutSchema,
  handler: async (input, ctx) => {
    // 2. Load the active product — amount + currency are server-owned.
    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.slug, input.productSlug), eq(productsTable.active, true)))
      .limit(1)

    if (!product) {
      return { error: "找不到商品，或商品已下架。" }
    }

    // Gateway override (validated to stripe/ecpay) or the deployment default.
    const providerKey: ProviderKey = input.gateway ?? resolveProviderKey()

    // 3. Create the pending order (guest checkout keeps user_id null). First-party
    //    UTM (E334) rides along so the funnel can attribute the eventual payment;
    //    an all-empty bag persists as null (direct traffic).
    const utm = normalizeUtm(input.utm ?? null)
    const [order] = await db
      .insert(ordersTable)
      .values({
        productId: product.id,
        userId: ctx.actorId ?? null,
        customerEmail: input.email,
        customerName: input.name ?? null,
        provider: providerKey,
        amount: product.amount,
        currency: product.currency,
        status: "pending",
        utm: isEmptyUtm(utm) ? null : utm,
      })
      .returning({ id: ordersTable.id })

    if (!order) {
      return { error: "建立訂單失敗，請稍後再試。" }
    }

    // 4. Resolve the one-time gateway (DIP: via the resolver, not a concrete import)
    //    and open a hosted checkout. The order id rides gateway metadata so the
    //    settlement webhook can map the callback back to this order.
    const gateway = await resolveOneTime(providerKey)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    const token = orderAccessToken(order.id, input.email)
    const successUrl = `${appUrl}/p/${product.slug}/thanks?order=${order.id}&token=${token}`
    const cancelUrl = `${appUrl}/p/${product.slug}`

    const checkout = await gateway.createCheckout({
      // One-time mode: providers price from amount/currency/productName below;
      // planId is unused on this path (kept as the product slug for traceability).
      planId: product.slug,
      mode: "one-time",
      // orderId rides gateway metadata (Stripe metadata.orderId / ECPay
      // CustomField3) so the settlement route maps the callback back to orders.id.
      orderId: order.id,
      amount: product.amount,
      currency: product.currency,
      productName: product.name,
      userId: ctx.actorId ?? "",
      successUrl,
      cancelUrl,
      customerEmail: input.email,
    })

    // 5. ECPay returns an auto-submit form as a data: URI; Stripe returns a URL.
    const isFormHtml = checkout.checkoutUrl.startsWith(DATA_HTML_PREFIX)
    const data: { orderId: string; redirectUrl?: string; formHtml?: string } = isFormHtml
      ? {
          orderId: order.id,
          formHtml: decodeURIComponent(checkout.checkoutUrl.slice(DATA_HTML_PREFIX.length)),
        }
      : { orderId: order.id, redirectUrl: checkout.checkoutUrl }

    return {
      data,
      audit: {
        actorId: ctx.actorId,
        action: "order.checkout_started",
        targetType: "order",
        targetId: order.id,
        metadata: {
          provider: providerKey,
          productSlug: product.slug,
          amount: product.amount,
          currency: product.currency,
          guest: ctx.actorId === null,
        },
      },
    }
  },
})

/**
 * Open a unified one-time checkout for a product. Guests may buy — no login
 * required. Returns `{ ok, orderId, redirectUrl | formHtml }` or `{ error }`.
 */
export async function createOneTimeCheckout(
  input: OneTimeCheckoutInput,
): Promise<OneTimeCheckoutResult> {
  const result = await createOneTimeCheckoutAction(input)
  if ("error" in result) return { error: result.error }
  return {
    ok: true,
    orderId: result.orderId,
    redirectUrl: result.redirectUrl,
    formHtml: result.formHtml,
  }
}
