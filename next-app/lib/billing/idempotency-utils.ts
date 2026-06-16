/**
 * Pure idempotency helpers (E274) — NO db import, unit-testable WITHOUT a
 * DATABASE_URL.
 *
 * The webhook handlers dedup on Postgres' unique-violation by the SQLSTATE CODE
 * (23505), NOT by string-matching the human-readable error message. The
 * `postgres` driver surfaces the code on `err.code` (and exposes the violated
 * constraint name on `err.constraint_name`). Matching the code is locale- and
 * wording-independent, so a translated/Postgres-version-shifted message can
 * never silently break dedup.
 */

/** Postgres SQLSTATE for unique_violation. */
export const PG_UNIQUE_VIOLATION = "23505" as const

/** Structural shape of a Postgres driver error we care about. */
interface PgErrorLike {
  code?: unknown
  constraint_name?: unknown
  constraint?: unknown
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

/**
 * Optionally narrow a unique-violation to a specific constraint name, so a
 * handler can distinguish (e.g.) the `payment_events_provider_event_id_unique`
 * dedup from a `subscriptions_provider_sub_id_unique` race. Returns false when
 * the error is not a unique violation at all.
 */
export function isUniqueViolationOn(err: unknown, constraintName: string): boolean {
  if (!isUniqueViolation(err)) return false
  const e = err as PgErrorLike
  const name = e.constraint_name ?? e.constraint
  return typeof name === "string" && name === constraintName
}
