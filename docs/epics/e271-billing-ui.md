# E271 — Billing UI

**Phase:** 62 | **Status:** ⬜ | **Depends:** none

## Problem

Phase 58 shipped the billing *backend* (plans/subscriptions/payment_events + PaymentProvider), but there's no UI for a user to see their plan, usage, or invoices.

## Solution

A read-only Billing UI over the existing Phase 58 tables — plan summary, usage meter, payment-method placeholder, invoice history. **No new table.**

## Key Files

- `next-app/lib/billing/queries.ts` — `getActiveSubscription(userId)`, `getInvoices(userId)` (read plans/subscriptions/payment_events)
- `next-app/app/(dashboard)/dashboard/system/billing/page.tsx` — plan card + usage meter + invoice table
- `next-app/components/billing/*` — plan-summary, usage-meter, invoice-table
- `next-app/lib/billing/queries.test.ts` — subscription read shape

## Implementation

1. Queries over `subscriptionsTable` (status/currentPeriodEnd/plan join) + `paymentEventsTable` (invoice history) + `plansTable`.
2. Plan summary card (name/price/interval/status badge via StatusBadge) + a usage meter (progress bar; placeholder metric until usage metering exists) + invoice history table (from payment_events) + payment-method placeholder ("managed via Stripe portal").
3. RBAC: a user sees only their own subscription (owner-scoped). Empty state when no subscription.

## Acceptance Criteria

- [ ] Billing page renders plan summary + usage meter + invoice history for the current user (empty state when none).
- [ ] Reads only existing Phase 58 tables; no schema change.
- [ ] `pnpm test` covers the subscription read shape; typecheck+lint+build green.

## Out of Scope

- Real usage metering (placeholder meter). Stripe Customer Portal wiring (link/placeholder). Plan upgrade/downgrade flow.

## Migration note

No schema change (reads existing tables) — excluded from the Phase 62 migration.
