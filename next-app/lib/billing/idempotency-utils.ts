/**
 * Pure idempotency helpers (E274) — NO db import, unit-testable WITHOUT a
 * DATABASE_URL.
 *
 * The webhook handlers dedup on Postgres' unique-violation by the SQLSTATE CODE
 * (23505), NOT by string-matching the human-readable error message. The
 * `postgres` driver surfaces the code on `err.code`. Matching the code is locale-
 * and wording-independent, so a translated/Postgres-version-shifted message can
 * never silently break dedup.
 *
 * NB: a constraint-name-specific variant was removed in E324 — the idempotency
 * sites (stripe/webhook + ecpay return/period) all dedup via DB-level
 * `onConflictDoNothing`/`onConflictDoUpdate`, which is already constraint-aware at
 * the DB, so no application-level constraint narrowing is needed. The one
 * catch-site (lib/billing/plans.ts) only needs the generic code check.
 */

/** Postgres SQLSTATE for unique_violation. */
export const PG_UNIQUE_VIOLATION = "23505" as const

/** Structural shape of a Postgres driver error we care about. */
interface PgErrorLike {
  code?: unknown
}

/**
 * True iff the given thrown value is a Postgres unique-violation (SQLSTATE
 * 23505). Detection is by error CODE only — never the message text.
 */
export function isUniqueViolation(err: unknown): boolean {
  if (err == null || typeof err !== "object") return false
  const code = (err as PgErrorLike).code
  return code === PG_UNIQUE_VIOLATION
}
