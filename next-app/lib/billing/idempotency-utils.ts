/**
 * Pure idempotency helpers (E274) — NO db import, unit-testable WITHOUT a
 * DATABASE_URL.
 *
 * `isUniqueViolation`/`PG_UNIQUE_VIOLATION` were generalized out of this
 * module in E354 into `lib/db-errors.ts` (a Postgres unique-violation check
 * is not billing-specific — `actions/sales-pages.ts` needed the exact same
 * code-based check for slug uniqueness). This file re-exports them so the
 * existing billing call sites (`app/api/billing/stripe/webhook/route.ts`,
 * `lib/billing/plans.ts`) and their imports keep working unchanged.
 *
 * See `lib/db-errors.ts` for why detection is by SQLSTATE CODE only — never
 * the message text.
 *
 * NB: a constraint-name-specific variant was removed in E324 — the idempotency
 * sites (stripe/webhook + ecpay return/period) all dedup via DB-level
 * `onConflictDoNothing`/`onConflictDoUpdate`, which is already constraint-aware at
 * the DB, so no application-level constraint narrowing is needed. The one
 * catch-site (lib/billing/plans.ts) only needs the generic code check.
 */

export { PG_UNIQUE_VIOLATION, isUniqueViolation } from "@/lib/db-errors"
