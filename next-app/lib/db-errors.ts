/**
 * Domain-neutral Postgres error classification (E354).
 *
 * `isUniqueViolation()` used to live under `lib/billing/idempotency-utils.ts`
 * (E274) — but detecting a unique-key conflict is not a billing concern, it's a
 * generic Postgres concern, so any module that inserts/updates a uniquely-
 * constrained column needs it (billing webhooks, `sales-pages` slug uniqueness,
 * future callers).
 *
 * Detection is by SQLSTATE **CODE** only — never the human-readable message
 * text. The `postgres` driver surfaces the code on `err.code`. Matching the
 * code is locale- and wording-independent, and — critically — independent of
 * the *constraint name*: Drizzle auto-generates constraint names from
 * `.unique()` column definitions, and a migration that renames or rebuilds a
 * constraint silently changes that string. A message/constraint-name string
 * match then either false-negatives (a friendly error becomes an unhandled
 * 500) or, worse, false-positives against unrelated wording. The SQLSTATE is
 * stable across Postgres versions, locales, and schema changes — it is the
 * only durable signal.
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
