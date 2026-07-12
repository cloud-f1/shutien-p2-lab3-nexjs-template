# E327 — 一次性購買：products/orders + 統一結帳（ECPay-first）

> Phase 77 · feature/backend · Cycle 35（數位產品/課程銷售頁 PRD，2026-07-12）
> Status: ⬜ pending

## Problem

Billing today is subscription-shaped (`plans`/`subscriptions`, E249). The sales-page PRD sells
**one-time purchases** of digital products. `PaymentProvider.createCheckout` already supports
one-time payments by contract, but there is no product/order data model, no unified checkout entry
point, and no thank-you/settlement flow. Launch gateway decision: **ECPay 綠界 primary**（user
decision 2026-07-12）— Stripe stays the code-level resolver default; deployments set
`BILLING_PROVIDER=ecpay`.

## Solution

1. **Schema (Drizzle, per `drizzle-migration-safety`)**:
   - `products` — id, slug UNIQUE, name, description, amount (integer, minor units), currency
     (default `TWD`), active, `entitlement_key` (consumed by E328), timestamps
   - `orders` — id, product_id FK, user_id FK **nullable** (guest checkout by email), customer_email,
     customer_name, provider, provider_order_id, amount, currency, status
     (`pending|paid|failed|refunded`), paid_at, timestamps. Idempotent settlement rides the existing
     `payment_events.provider_event_id UNIQUE` — no new idempotency machinery.
   - Seed: 1 example product matching E326's example slug (dev seed only).
2. **Unified checkout entry** — Server Action `createOneTimeCheckout` in `next-app/actions/checkout.ts`
   (via `defineAction`, `// stop-verifier:public-action` — guests may buy): Zod-validated payload
   (productSlug, email, name, gateway override optional) → creates `pending` order → resolver picks
   provider → `provider.createCheckout({ mode: "one-time", … })` → returns either `redirectUrl`
   (Stripe session URL) or `formHtml` (ECPay auto-submit form), matching the PRD's
   `UnifiedCheckoutPayload` semantics. Client helper renders/submits the form or redirects.
3. **Settlement** — extend the existing webhook routes (`/api/billing/ecpay/return`,
   `/api/billing/stripe/webhook`) with a shared `settleOrder()` helper (`lib/billing/orders.ts`):
   verifyWebhook → record `payment_events` → mark order `paid` + `paid_at` (idempotent). E329's
   NewebPay notify route reuses the same helper.
4. **感謝頁** — `app/p/[slug]/thanks/page.tsx`: reads order by id+email token, shows
   paid/pending state (ECPay return can race the notify — poll or refresh hint).
5. **ECPay-first ops**: `.env.example` sales section documents `BILLING_PROVIDER=ecpay`; QA runs the
   ECPay one-time flow first; deploy guide note (Zeabur env). Resolver code default (`stripe`)
   unchanged — no behavior change for existing installs.

## Key Files
- `next-app/lib/schema.ts` + `drizzle/migrations/*` (products, orders) + migration-review artifact
- `next-app/actions/checkout.ts` · `next-app/lib/billing/orders.ts`
- `next-app/app/api/billing/ecpay/return/route.ts` · `.../stripe/webhook/route.ts` (extend)
- `next-app/app/p/[slug]/thanks/page.tsx` · `next-app/.env.example`

## Acceptance Criteria
- [ ] Migration generated + applies on fresh DB; migration-review artifact (Rule #19)
- [ ] `createOneTimeCheckout`: ECPay path returns auto-submit form HTML (CheckMacValue valid per
      existing ecpay util tests); Stripe path returns `mode: 'payment'` session URL
- [ ] Duplicate webhook delivery settles the order exactly once (`payment_events` UNIQUE test)
- [ ] Guest checkout works (no session); logged-in checkout links `user_id`
- [ ] 感謝頁 shows paid vs pending correctly for the return-races-notify case
- [ ] Vitest: payload Zod, settleOrder idempotency, provider dispatch; typecheck/lint/build green

## Cross-Epic
- E249 — implements the one-time half of the existing `PaymentProvider` contract; no interface change
- E326 — sales-page CTA calls `createOneTimeCheckout`
- E328 — consumes `orders.status='paid'` + `products.entitlement_key`
- E329 — NewebPay notify route reuses `settleOrder()`

## Out of Scope
- 交付開通/內容存取 → E328；NewebPay provider → E329
- Refund flows beyond status enum; invoicing/電子發票 (future epic)
