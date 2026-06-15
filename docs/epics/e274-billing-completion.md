# E274 — Billing completion + JSON-configurable pricing

> Phase 64 · billing · branch `feat/E274-billing`
> Source: the 2026-06-15 billing audit (webhooks complete, payment flow not wired)
> + user requirement: **pricing must be JSON-configurable — no hardcoded tiers in code**.

## Problem (from audit)

Stripe + 綠界 ECPay have solid adapters and **fully working webhooks** (signature verify +
`payment_events` idempotency + DB upserts + out-of-order tolerance). But **no real payment can
be initiated or sustained**, and pricing tiers were hardcoded in `pricing.tsx`:

1. **Checkout dead-on-arrival** — `createCheckoutSession` had zero callers; CTAs linked to `/register`.
2. **Plan-identity incoherent** — tiers used slugs, seed used `price_*_demo`, action passed the
   provider price-ID, but `subscriptions.planId` is a UUID FK → a real checkout would fail to insert.
3. **Hardcoded pricing** — tiers lived in `DEFAULT_PRICING_TIERS` in code; changing a plan = code edit.
4. ECPay renewal has no scheduler · `reconcile()` stubbed · `chargeRecurring` no-op (ECPay) ·
   `currentPeriodEnd` always null · no cancel UI · brittle idempotency · zero route/action tests.

## Solution — `config/pricing.json` as the single source

`config/pricing.json` defines all tiers (slug, name, monthlyPrice, interval, **providerPriceId**,
features, badge, ctaLabel). The pricing page, the DB seed (`plans`), and checkout **all derive
from it** — editing the JSON is the only change needed to alter plans. This also fixes the
plan-identity model: `providerPriceId` is the join key (config ↔ `plans` ↔ gateway).

## Tasks

- [x] **(E274a) JSON pricing** — `config/pricing.json` + `lib/billing/pricing.ts` loader/helpers
  (`PRICING_TIERS`/`PAID_TIERS`/`getTierBySlug`/`getTierByPriceId`); `pricing.tsx` renders from it;
  seed derives `plans` from `PAID_TIERS`; test moved to `lib/billing/pricing.test.ts`.
- [x] **(E274a) Wire checkout (#1)** — paid-tier CTA → `createCheckoutSession(providerPriceId,…)` →
  redirect to `checkoutUrl`. Free tier → `/register`.
- [ ] **Plan-identity FK fix (#2)** — checkout resolves the `plans` row by `providerPriceId`, carries
  the **plan UUID** in `metadata.planId`; webhooks write the UUID into `subscriptions.planId`.
- [ ] **`currentPeriodEnd`** — populate from Stripe sub + ECPay meta; show renewal date in BillingPanel.
- [ ] **Cancel subscription** — `actions/billing.ts::cancelSubscription` + BillingPanel button (ConfirmDialog).
- [ ] **`reconcile()`** — real diff gateway ↔ `subscriptions`; wire to a recovery route/job.
- [ ] **ECPay renewal scheduler** — `app/api/billing/ecpay/renew/route.ts` (cron) → `queryAndCheckRenewal`.
- [ ] **Idempotency robustness** — dedup on the PG unique-violation code, not string-match.
- [ ] **Tests** — route-handler + checkout-action integration tests; billing e2e (CTA reachable, cancel).

## Acceptance Criteria

- [x] Pricing is fully driven by `config/pricing.json`; no tier literals in code.
- [ ] A signed-in user clicks a paid tier → reaches the gateway checkout.
- [ ] A completed payment writes `subscriptions` with a valid `plans.id` FK + `payment_events`.
- [ ] BillingPanel shows active plan + renewal date + working cancel.
- [ ] `reconcile()` recovers a missed-webhook subscription; ECPay renews before `ExecTimes` exhausts.
- [ ] Route handlers + checkout action tested; billing e2e green; typecheck + lint + build green.

## Out of Scope

- Stripe Customer Portal embed (cancel handled in-app) · proration / mid-cycle upgrades ·
  TapPay / NewebPay providers (reserved slots).
