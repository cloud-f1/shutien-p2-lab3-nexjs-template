/**
 * e2e seed-account state hygiene (E373).
 *
 * The failure this exists to stop, observed THREE times in Phase 89:
 *
 *   `two-factor.spec.ts` enables 2FA on the seeded editor account, captures the
 *   secret in a module-level variable, and disables it again in `afterAll`.
 *   That teardown opens with `if (!capturedSecret) return` — so if ANY test in
 *   that file fails first (or the run is interrupted), the secret is never
 *   captured, the teardown bails, and 2FA is left ENABLED on editor@example.com.
 *
 *   Every later run then has its editor password logins redirected to
 *   /login/2fa and times out. Observed self-amplification: 11 failures on one
 *   run, 16 on the next. Only `pnpm db:e2e-setup` (drop → create → migrate →
 *   seed) put it back.
 *
 * Two defences, because either alone is insufficient:
 *   1. `globalTeardown` clears the flag DIRECTLY in the DB, unconditionally —
 *      it does not need a TOTP code, a browser, or anything a failing test
 *      might have failed to produce.
 *   2. `globalSetup` refuses to start from a dirty state, LOUDLY. If defence 1
 *      is ever bypassed (a `kill -9`, a crashed worker), the next run says so
 *      in one line instead of producing a fresh batch of 30-second timeouts
 *      that look like a product bug. Same posture as E357's target check:
 *      better an explicit abort than a plausible-looking wrong answer.
 *
 * Deliberately talks to Postgres directly rather than through `@/lib/db`:
 * globalSetup/globalTeardown run outside Next's module graph, and this file
 * must not drag the server runtime (or the `server-only` guard) into them.
 */
import bcrypt from "bcryptjs"
import postgres from "postgres"

/** Seeded demo accounts whose state must be identical at the start of every run. */
export const SEED_EMAILS = [
  "admin@example.com",
  "editor@example.com",
  "viewer@example.com",
] as const

/** Resolve the SAME database URL playwright.config.ts hands the dev server. */
export function resolveE2eDatabaseUrl(): string {
  return (
    process.env.E2E_DATABASE_URL ??
    process.env.DATABASE_URL ??
    "postgresql://saas_user:saas_pass@localhost:5432/saas_dev_e2e"
  )
}

type DirtyAccount = { email: string; totpEnabled: boolean; lockedUntil: Date | null }

/**
 * Open a short-lived connection, run `fn`, always close.
 *
 * Returns `null` ONLY when the database could not be reached — and that is
 * decided by a dedicated `select 1` probe, never by catching around `fn`.
 *
 * This split is the whole point. The first draft wrapped everything in one
 * `try { ... } catch { return null }` and shipped with a broken query
 * (`sql.array(...)` on the right of `ANY()` → "op ANY/ALL (array) requires
 * array on right side"). The helper therefore never worked at ALL, while
 * announcing a benign reason for its own malfunction: "seed-state teardown
 * SKIPPED — database unreachable". A guard that explains away its own failure
 * is worse than no guard, because it stops anyone from looking.
 *
 * Structuring it this way makes that class of mistake impossible rather than
 * merely currently-absent: a query error has no path to the `null` return.
 * (Same lesson as E366's exemption paths and E368's scanner that matched
 * nothing — and it is why `e2e/**` being outside vitest's reach costs nothing
 * here: there is no classifier left to unit-test.)
 */
async function withDb<T>(
  fn: (sql: ReturnType<typeof postgres>) => Promise<T>,
): Promise<T | null> {
  const sql = postgres(resolveE2eDatabaseUrl(), {
    max: 1,
    onnotice: () => {},
    connect_timeout: 5,
  })

  try {
    await sql`select 1`
  } catch {
    await sql.end({ timeout: 5 }).catch(() => {})
    return null // the ONLY route to null: we genuinely could not connect
  }

  try {
    return await fn(sql) // query errors propagate — always
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {})
  }
}

/**
 * Seed accounts that are NOT in their pristine post-seed state.
 *
 * Returns `null` when the database cannot be reached at all — the caller must
 * treat that as "cannot tell" and stay quiet, because e2e can legitimately run
 * against a target whose DB this process has no route to (a container, a remote
 * preview). Refusing to start in that case would be a worse failure than the
 * one we are preventing.
 */
export async function findDirtySeedAccounts(): Promise<DirtyAccount[] | null> {
  return withDb(async (sql) => {
    const rows = await sql<
      { email: string; totp_enabled: boolean; locked_until: Date | null }[]
    >`
      SELECT email, totp_enabled, locked_until
      FROM users
      WHERE email = ANY(${[...SEED_EMAILS]})
        AND (totp_enabled = true OR locked_until IS NOT NULL)
    `
    return rows.map((r) => ({
      email: r.email,
      totpEnabled: r.totp_enabled,
      lockedUntil: r.locked_until,
    }))
  })
}

/**
 * Return every seed account to its pristine auth state: 2FA off, no secret, no
 * backup codes, no lockout. Idempotent and unconditional — no captured secret,
 * no browser, no TOTP code required, which is precisely why it survives a test
 * failure that the in-spec teardown does not.
 *
 * Returns the number of rows it actually had to change (0 on a clean run), or
 * `null` when the DB is unreachable.
 */
export async function resetSeedAuthState(): Promise<number | null> {
  return withDb(async (sql) => {
    const rows = await sql`
      UPDATE users
      SET totp_enabled = false,
          totp_secret = null,
          backup_codes = null,
          failed_login_count = 0,
          locked_until = null
      WHERE email = ANY(${[...SEED_EMAILS]})
        AND (totp_enabled = true
             OR totp_secret IS NOT NULL
             OR backup_codes IS NOT NULL
             OR failed_login_count <> 0
             OR locked_until IS NOT NULL)
      RETURNING email
    `
    return rows.length
  })
}

// ---------------------------------------------------------------------------
// Ephemeral per-run accounts (E373)
// ---------------------------------------------------------------------------
//
// Clearing 2FA residue from the DB was only half the problem. The other half is
// NOT in the database at all: `verifyTotpLogin` is guarded by
// `rateLimitGuard("2fa:login:" + userId, 5, 15min)`, whose bucket lives in the
// in-process Map in lib/rate-limit.ts. A warm dev server therefore CARRIES
// 2FA attempt counts across e2e runs, and `pnpm db:e2e-setup` cannot touch it —
// it is not a row. Three consecutive full runs inside 15 minutes exhaust the
// budget for editor@example.com and the 2FA specs start failing on the shared
// account for reasons that look nothing like the real cause. (Confirmed by
// experiment: restarting the dev server — the only way to clear that Map —
// makes them pass again immediately.)
//
// A fresh user per run fixes both halves at once: nothing is left on the shared
// seed account, and the limiter key (which is the user id) is new every time.

const EPHEMERAL_PREFIX = "e2e-ephemeral-"

/** Password used for every ephemeral account. Must satisfy the register schema. */
export const EPHEMERAL_PASSWORD = "Ephemeral1234"

/**
 * Create a throwaway, already-verified account for one spec file's run.
 * Returns `null` when the DB is unreachable, so a caller targeting a remote
 * server can skip rather than fail.
 */
export async function provisionEphemeralUser(
  label: string,
  role: "admin" | "editor" | "viewer" = "editor",
): Promise<{ email: string; password: string } | null> {
  const email = `${EPHEMERAL_PREFIX}${label}-${process.pid}@example.com`
  const hash = await bcrypt.hash(EPHEMERAL_PASSWORD, 10)
  const created = await withDb(async (sql) => {
    await sql`
      INSERT INTO users (email, name, password_hash, email_verified, role, status)
      VALUES (${email}, ${`E2E ${label}`}, ${hash}, now(), ${role}, 'active')
      ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            email_verified = now(),
            totp_enabled = false,
            totp_secret = null,
            backup_codes = null,
            failed_login_count = 0,
            locked_until = null
    `
    return true
  })
  return created === null ? null : { email, password: EPHEMERAL_PASSWORD }
}

/** Delete every ephemeral account this machine has ever left behind. */
export async function cleanupEphemeralUsers(): Promise<number | null> {
  return withDb(async (sql) => {
    const rows = await sql`
      DELETE FROM users WHERE email LIKE ${EPHEMERAL_PREFIX + "%"} RETURNING email
    `
    return rows.length
  })
}
