// Shared metadata for OAuth providers — keep UI labels consistent across the
// auth pages and the Settings "Connected Accounts" tab. The DrizzleAdapter
// stores the lowercase provider id (e.g. "google", "github") on accountsTable;
// map those ids to a human-readable display name here.

export const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  credentials: "電子郵件",
}

/**
 * Human-readable display name for a stored provider id.
 * Falls back to a Title-cased version of the raw id for unknown providers.
 */
export function providerLabel(provider: string): string {
  return (
    PROVIDER_LABELS[provider.toLowerCase()] ??
    provider.charAt(0).toUpperCase() + provider.slice(1)
  )
}

// ─── E355 — persistent login lockout (pure decision layer) ───────────────────
//
// A SECOND, DB-backed layer over the in-memory throttle in lib/rate-limit.ts
// (which keeps the per-IP bucket and is lost on restart). These functions own
// ONLY the deterministic count/lock arithmetic; the two password-verification
// call sites read the persisted columns, call these, and write the result back
// to `users.failed_login_count` / `users.locked_until`:
//
//   1. lib/auth.ts   authorizeCredentials()  — non-2FA users
//   2. actions/auth.ts loginAction()          — the 2FA branch (TOTP users have
//      their password verified there, because authorize() refuses raw
//      credentials for them and completes via the nonce path instead)
//
// Keeping the policy pure means it is unit-testable without a database.

/** Consecutive failed-password attempts that trigger a lockout. */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5

/** How long an account stays locked once the threshold is hit (15 minutes). */
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000

/** Just the lockout-relevant columns of a user row (what these helpers read). */
export type LockoutState = {
  failedLoginCount?: number | null
  lockedUntil?: Date | null
}

/**
 * Is the persistent lockout feature switched on?
 *
 * `ENABLE_LOGIN_LOCKOUT` deliberately has NO `NEXT_PUBLIC_` prefix, so it is a
 * **server-side runtime env** (see CLAUDE.md "Runtime-vs-build-time env"): an
 * operator can flip it per service/environment and it takes effect on the next
 * request, with no rebuild.
 *
 * Default: **ON** (secure by default). A security control that defaults to off
 * is one that in practice never gets turned on. Only an explicit
 * `false` / `0` / `off` (case-insensitive) disables it.
 *
 * When disabled the feature is a COMPLETE no-op — mirroring the template's
 * Sentry convention (`SENTRY_DSN` unset ⇒ instrumentation.ts does nothing):
 * nothing is counted, nothing is locked, and NO DB write happens.
 *
 * ESCAPE-HATCH semantics (deliberate, decided 2026-08-27): while disabled,
 * `isLocked()` also ignores an ALREADY-persisted `lockedUntil`. An operator
 * reaches for this flag precisely because someone is locked out and needs back
 * in — honouring the stored lock would mean the locked-out user still has to
 * wait the full 15 minutes, i.e. the switch would do nothing for the one
 * scenario it exists for. The column values are left in the DB untouched, so
 * re-enabling the flag restores the original semantics.
 */
export function isLockoutEnabled(
  raw: string | undefined = process.env.ENABLE_LOGIN_LOCKOUT,
): boolean {
  if (raw == null) return true
  const v = raw.trim().toLowerCase()
  if (v === "") return true // unset-ish (some hosts materialise "" for an absent var)
  return !(v === "false" || v === "0" || v === "off")
}

/**
 * True when the account is currently locked — `lockedUntil` is set and still in
 * the future relative to `now`. A null/absent user or an expired lock is NOT
 * locked. Callers check this BEFORE comparing the password, so a locked account
 * is rejected without paying for a bcrypt hash.
 *
 * Returns false unconditionally when `isLockoutEnabled()` is false (escape
 * hatch — see above).
 */
export function isLocked(
  user: LockoutState | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!isLockoutEnabled()) return false
  if (!user?.lockedUntil) return false
  return user.lockedUntil.getTime() > now.getTime()
}

/**
 * Compute the next persisted lockout state after ONE failed password attempt.
 *
 * - If a prior lock has already expired, the counter starts FRESH — a user gets
 *   a full new set of attempts once the window passes, rather than being
 *   re-locked by a single miss (Acceptance #4).
 * - Otherwise the counter increments; on reaching MAX_FAILED_LOGIN_ATTEMPTS the
 *   account is locked for LOCKOUT_DURATION_MS measured from `now`.
 *
 * Pure — the caller persists the returned fields. The lock is set ON the 5th
 * consecutive failure, so the 6th attempt is the one blocked by isLocked().
 */
export function nextFailedState(
  user: LockoutState | null | undefined,
  now: Date = new Date(),
): { failedLoginCount: number; lockedUntil: Date | null } {
  const priorLockExpired =
    user?.lockedUntil != null && user.lockedUntil.getTime() <= now.getTime()
  const base = priorLockExpired ? 0 : (user?.failedLoginCount ?? 0)
  const failedLoginCount = base + 1
  const lockedUntil =
    failedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS
      ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
      : null
  return { failedLoginCount, lockedUntil }
}

/**
 * The cleared state written after a SUCCESSFUL password verification: zero the
 * counter and drop any lock.
 */
export function clearedLoginState(): { failedLoginCount: number; lockedUntil: null } {
  return { failedLoginCount: 0, lockedUntil: null }
}

/**
 * True when there is anything worth clearing — lets the call sites skip a
 * pointless UPDATE on the overwhelmingly common clean-login path.
 */
export function hasLoginFailuresToClear(user: LockoutState | null | undefined): boolean {
  if (!user) return false
  return (user.failedLoginCount ?? 0) > 0 || user.lockedUntil != null
}

/** User-facing message for a locked account (繁體中文, matches the auth pages). */
export const ACCOUNT_LOCKED_MESSAGE = "此帳號因多次登入失敗已暫時鎖定，請於 15 分鐘後再試。"
