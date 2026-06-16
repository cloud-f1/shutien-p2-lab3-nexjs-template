# E292 — Stripe Customer Portal redirect + billing e2e

> Phase 65 · billing · branch `feat/E292-billing-portal`
> Source: E274 left "manage billing" (invoices / payment-method) as a placeholder and the
> money-path has **zero e2e coverage**.

## Problem

E274 shipped checkout + in-app cancel, but the BillingPanel's payment-method / invoices block is a
static placeholder ("串接 Customer Portal 後將在此顯示"). Users have no way to update a card or
download an invoice. Separately, the billing surface has **no Playwright e2e** — the panel could
silently regress.

## Solution

1. **`createPortalSession` server action** (`actions/billing.ts`) — `requireAuth`, owner-scoped.
   For the **Stripe** provider, resolve the customer id from the user's live subscription
   (`subscriptions.providerMeta.customer`, written by the webhook), call
   `stripe.billingPortal.sessions.create({ customer, return_url })` and return `{ url }`.
   Non-Stripe (ECPay) providers return a clear "not supported" result (綠界 has no equivalent
   hosted portal; management is in-app). The provider-agnostic URL/arg logic lives in a **db-free
   util** (`lib/billing/portal-utils.ts`) with unit tests.
2. **BillingPanel** — a "管理帳務 / Manage billing" button, **Stripe-only** (hidden for ECPay).
   It's a client component using `useTransition`; on success it sets `window.location.href = url`.
   No ConfirmDialog (read-only redirect, not a destructive mutation).
3. **e2e** (`e2e/billing.spec.ts`) — demo-login → `/dashboard/system` → switch to the 帳務 tab →
   assert the billing panel renders (plan-or-empty state + cancel / manage-billing affordances are
   present + wired). Does **not** hit real Stripe.

## Key Files

- `lib/billing/portal-utils.ts` (new) — `resolveStripeCustomerId(providerMeta)` + `buildPortalReturnUrl(origin)`
  + `PORTAL_UNSUPPORTED_MESSAGE` (pure, db-free).
- `lib/billing/portal-utils.test.ts` (new) — unit tests for the arg shape / customer resolution.
- `actions/billing.ts` — add `createPortalSession`.
- `actions/billing.test.ts` — add `createPortalSession` argument-shape tests.
- `app/(dashboard)/dashboard/system/_manage-billing-button.tsx` (new) — client redirect button.
- `app/(dashboard)/dashboard/system/_billing-panel.tsx` — render the button (Stripe only).
- `e2e/billing.spec.ts` (new) — Playwright coverage for the billing panel.

## Acceptance Criteria

- [x] `createPortalSession` requires auth, is owner-scoped, returns `{ success, url }` for Stripe and
      a clear unsupported result for ECPay.
- [x] Customer-id resolution + return-url building are pure + unit-tested.
- [x] BillingPanel shows a Stripe-only "管理帳務" button that redirects to the portal url.
- [x] `e2e/billing.spec.ts` signs in and asserts the billing panel + cancel/manage affordances.
- [x] typecheck + lint + unit + build green.

## Out of Scope

- A live e2e redirect to Stripe's hosted portal (the e2e asserts UI wiring, not a live gateway hit).
- ECPay hosted portal (綠界 has none; management stays in-app).
- Proration / mid-cycle plan changes · invoices rendered in-app (the portal owns them).
