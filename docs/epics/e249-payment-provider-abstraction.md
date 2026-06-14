# E249 — PaymentProvider Abstraction + Billing Schema

**Phase:** 58 | **Status:** ⬜ | **Depends:** none (parallel with E247/E248)

## Problem

Billing must support multiple gateways (Stripe default; ECPay local; TapPay / NewebPay 藍新
future) without rewiring the app. We need one provider contract + the billing data model
*before* any concrete provider, so billing is registry-izable and swappable.

## Solution

- `lib/billing/provider.ts`: `PaymentProvider` interface — `createCheckout`,
  `createSubscription`, `chargeRecurring`, `cancelSubscription`, `verifyWebhook`,
  `reconcile` — plus shared types (Plan, Subscription, CheckoutResult, WebhookVerifyResult).
- `lib/billing/resolver.ts`: env-selected provider (`BILLING_PROVIDER`, **default `stripe`**);
  throws a clear error if an unimplemented slot (`tappay` / `newebpay`) is selected.
- Drizzle tables in `lib/schema.ts`:
  - `plans` (id, provider_price_id, interval, amount, currency, active)
  - `subscriptions` (id, user_id FK, plan_id FK, provider, provider_sub_id, status,
    current_period_end, cancel_at)
  - `payment_events` (id, provider, **provider_event_id UNIQUE**, type, payload, processed_at)
    — the idempotency table shared by all providers.
- Migration via `pnpm db:generate`; migration-review artifact per Rule #19.
- Contract + schema + tests only — **no concrete provider implemented here.**

## Acceptance

- [ ] `PaymentProvider` interface + shared types compile and are documented
- [ ] resolver returns `stripe` by default; errors cleanly for `tappay` / `newebpay` slots
- [ ] `plans` / `subscriptions` / `payment_events` migrations generated + applied on a fresh DB
- [ ] `payment_events.provider_event_id` UNIQUE enforces idempotency
- [ ] Vitest: resolver + interface contract tests green; no concrete provider imported

## Research-Informed Refinements (2nd pass · `woawzys1o`)

- ECPay tracks recurring progress by **count, not date** (`ExecTimes` / `TotalSuccessTimes`), unlike
  Stripe's period dates. Add a provider-neutral **`provider_meta` JSONB** column on `subscriptions` so
  each provider persists its own tracking shape (ECPay: `exec_times`/`total_success_times`/`exec_status`;
  Stripe: `current_period_end`). Keep the shared typed columns for the common case; `provider_meta`
  absorbs provider-specific state without schema churn when TapPay/NewebPay land in P57.
