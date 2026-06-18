# E301 — Usage Metering Foundation

> Phase 70 · billing · metering
> Status: ⬜ pending

## Problem

The billing panel (`_billing-panel.tsx`) shows a static `"— / —"` placeholder for usage. No usage tracking table, counter, or aggregation query exists anywhere. A fork team wiring Stripe metered billing or any usage-based pricing model has no foundation to attach their counters to.

This epic ships the metering plumbing — not a specific pricing model. Fork teams attach their own `recordUsage()` calls to whatever events matter for their product.

## Solution

1. **`usage_events` table** — Drizzle migration 0008 (or next available)
   - `id`, `userId`, `teamId` (nullable), `metric` (string), `delta` (int), `createdAt`
2. **`lib/usage-utils.ts`** — pure helper functions (db-free, unit-testable)
   - `aggregateUsage(events, metric)`, `getUsagePeriod(now)`, `formatUsageDisplay(current, limit)`
3. **`actions/usage.ts`** — `recordUsage(metric, delta)` Server Action (writes to DB)
4. **Billing panel wiring** — query current-month usage and render in place of `"— / —"`
5. **Unit tests** — `lib/usage-utils.ts` fully tested

## Key Files

- `next-app/lib/schema/billing.ts` — add `usageEvents` table
- `drizzle/migrations/` — migration for `usage_events`
- `next-app/lib/usage-utils.ts` (NEW) — pure aggregation helpers
- `next-app/lib/usage-utils.test.ts` (NEW) — unit tests
- `next-app/actions/usage.ts` (NEW) — `recordUsage` Server Action
- `next-app/app/(dashboard)/dashboard/settings/_billing-panel.tsx` — wire real usage query
- `next-app/lib/db/queries/usage.ts` (NEW) — Drizzle query: current-month usage by metric

## Implementation

### Phase 1 — Schema + utils
- Add `usageEvents` table to `lib/schema/billing.ts`
- Write migration SQL
- Write `lib/usage-utils.ts`: `aggregateUsage`, `getUsagePeriod`, `formatUsageDisplay`
- Write `lib/usage-utils.test.ts`: aggregation with mixed metrics, period boundary, zero-event case

### Phase 2 — Server Action + DB query
- `actions/usage.ts`: `recordUsage(metric, delta)` — validates session, writes to `usage_events`
- `lib/db/queries/usage.ts`: `getCurrentMonthUsage(userId, metric)` — Drizzle query with date filter
- Add a demo call to `recordUsage("api_request", 1)` in `app/api/v1/items/route.ts` as a reference

### Phase 3 — Billing panel wiring
- In `_billing-panel.tsx` (Server Component): call `getCurrentMonthUsage(userId, "api_request")`
- Replace `"— / —"` placeholder with `{current} / {plan.limit}` (or `{current} / ∞` for unlimited)
- Render a `<Progress>` bar if a limit is set

## Acceptance Criteria

- [ ] `usage_events` table exists in Drizzle schema + migration applies cleanly
- [ ] `lib/usage-utils.ts` has unit tests for all exported functions
- [ ] `recordUsage()` Server Action writes to the DB (requires session)
- [ ] Billing panel shows current-month `api_request` count instead of `"— / —"`
- [ ] Example `recordUsage` call exists in the v1 items route as a fork reference
- [ ] `pnpm db:test-migrate` passes with the new migration
- [ ] `pnpm test` + `pnpm typecheck` + `pnpm build` pass

## Out of Scope

- Stripe metered billing API integration (metering foundation only)
- Multiple metric types displayed simultaneously (single metric MVP)
- Usage alerts / overage emails
- Usage history chart
