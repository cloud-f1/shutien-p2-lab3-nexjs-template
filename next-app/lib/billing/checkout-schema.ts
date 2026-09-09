/**
 * Unified one-time checkout payload — E327.
 *
 * Kept in its own db-free module so the Zod contract is unit-testable without
 * importing the Server Action (which pulls in `@/lib/db` and throws at import
 * without DATABASE_URL). The action (`actions/checkout.ts`) imports this schema.
 *
 * Guests may buy, so there is no auth field — everything the buyer supplies is
 * validated here, server-side. `gateway` is an optional override restricted to
 * the gateways that support one-time checkout today (stripe / ecpay); when
 * omitted the resolver falls back to `BILLING_PROVIDER`.
 */

import { z } from "zod"

/** Gateways that can process a one-time checkout right now (E327). */
export const ONE_TIME_GATEWAYS = ["stripe", "ecpay"] as const

export const oneTimeCheckoutSchema = z.object({
  /** The product to buy, by slug. */
  productSlug: z
    .string({ message: "缺少商品代碼。" })
    .trim()
    .min(1, "缺少商品代碼。")
    .max(200, "商品代碼過長。"),
  /** Buyer email — receipt + guest order lookup key. */
  email: z
    .string({ message: "請輸入電子郵件。" })
    .trim()
    .min(1, "請輸入電子郵件。")
    .email("請輸入有效的電子郵件。"),
  /** Optional buyer name. */
  name: z.string().trim().min(1, "姓名不可為空白。").max(100, "姓名過長。").optional(),
  /** Optional gateway override (stripe / ecpay). */
  gateway: z.enum(ONE_TIME_GATEWAYS, { message: "不支援的付款方式。" }).optional(),
  /**
   * First-party UTM attribution captured on the sales-page visit (E334). Optional
   * — direct traffic sends none. Persisted to `orders.utm` so the funnel can show
   * which channel actually PAID, not just which brought traffic.
   */
  utm: z
    .object({
      source: z.string().trim().max(200).nullish(),
      medium: z.string().trim().max(200).nullish(),
      campaign: z.string().trim().max(200).nullish(),
    })
    .partial()
    .optional(),
})

export type OneTimeCheckoutInput = z.infer<typeof oneTimeCheckoutSchema>

/**
 * Per-client throttle for the ONE public (guest-reachable) checkout action.
 *
 * Lives here, not in `actions/checkout.ts`, because that file is `"use server"`
 * — every export there is a public endpoint, and Next only permits async
 * functions. Keeping the number in one place also stops the action and its
 * tests from drifting apart, which is exactly what E348/E352/E369 kept finding.
 *
 * Why 30/min rather than defineAction's conservative 10: the key is the client
 * IP, and CGNAT/office egress puts many REAL buyers behind one address. A
 * successful launch is the likeliest way to trip it and the failure is silent
 * lost revenue. 30/min still bounds an anonymous flooder hard. E375 logs a
 * `rate_limit.blocked` line the first time each bucket trips, so tuning this is
 * an observable exercise rather than a guess.
 */
export const ONE_TIME_CHECKOUT_RATE_LIMIT = { limit: 30, windowMs: 60_000 } as const
