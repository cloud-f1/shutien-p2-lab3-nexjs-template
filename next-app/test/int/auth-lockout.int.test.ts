/**
 * auth-lockout.int.test.ts — E355 persistent login lockout against a REAL
 * throwaway Postgres DB.
 *
 * The unit tests (lib/auth-utils.test.ts, lib/auth.test.ts, actions/auth.test.ts)
 * prove the arithmetic and the wiring with a mocked `db`. This file proves the
 * thing a mock CANNOT: that the counter and the lock are actually WRITTEN to
 * `users.failed_login_count` / `users.locked_until`, so the lockout survives a
 * process restart — the whole point of the epic, since lib/rate-limit.ts is a
 * per-process Map that a restart wipes.
 *
 * "Survives a restart" is demonstrated two ways:
 *   1. every assertion reads the row through an INDEPENDENT postgres-js
 *      connection (harness `sql`), never through the module's own state; and
 *   2. `vi.resetModules()` + a fresh dynamic import gives a brand-new module
 *      instance (all in-memory state gone) that still refuses the login.
 *
 * Both password paths are covered:
 *   path 1 — lib/auth.ts `authorizeCredentials` (non-2FA users)
 *   path 2 — actions/auth.ts `loginAction` 2FA branch (TOTP users)
 *
 * Follows the harness ordering trap: setupTestDb() in beforeAll BEFORE any
 * dynamic import of @/lib/db or a module that pulls it in.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { isPostgresReachable, setupTestDb, teardownTestDb, truncateDomain } from "./harness"

const reachable = await isPostgresReachable()
if (!reachable) {
  console.warn(
    "⏭ SKIP next-app/test/int/auth-lockout.int.test.ts — no reachable Postgres. " +
      "Start it with `docker compose up -d postgres` (repo root) or set TEST_DATABASE_URL, then re-run `pnpm test:int`.",
  )
}

// loginAction needs a request scope for headers()/redirect() and must not
// actually complete a NextAuth sign-in. `@/lib/auth` is only partially mocked:
// `authorizeCredentials` stays REAL (it is the code under test for path 1).
vi.mock("next/headers", () => ({
  headers: async () => new Map<string, string>(),
  cookies: async () => ({ set: () => {}, get: () => undefined, delete: () => {} }),
}))
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`__REDIRECT__:${to}`)
  },
  unstable_rethrow: () => {},
}))
// The 2FA cookie needs AUTH_SECRET + a real cookie store; stub the bridge.
vi.mock("@/lib/pending-2fa", () => ({
  setPending2fa: async () => {},
  readPending2fa: async () => null,
  clearPending2fa: async () => {},
  issueNonce: () => "nonce",
}))

process.env.AUTH_SECRET ??= "integration-test-secret-at-least-32-chars-long"

const PASSWORD = "Correct1234"
const WRONG = "Wrong1234"

describe.skipIf(!reachable)("E355 persistent login lockout — real DB", () => {
  let sql: Awaited<ReturnType<typeof setupTestDb>>["sql"]
  let authorizeCredentials: (
    creds: Record<string, unknown>,
  ) => Promise<{ id: string } | null>
  let loginAction: typeof import("@/actions/auth").loginAction
  let passwordHash: string
  /**
   * Reset the FIRST layer (lib/rate-limit.ts, 5 failures per email / 10 per IP).
   * Captured in beforeAll on purpose: one test calls vi.resetModules(), after
   * which a fresh `import("@/lib/rate-limit")` would hand back a DIFFERENT
   * module instance than the one loginAction closed over — resetting the wrong
   * Map and letting layer 1 silently mask layer 2.
   */
  let resetRateLimit: () => void

  beforeAll(async () => {
    const testDb = await setupTestDb()
    sql = testDb.sql

    // Dynamic imports — only AFTER DATABASE_URL points at the throwaway DB.
    const password = await import("@/lib/password")
    passwordHash = await password.hashPassword(PASSWORD)
    ;({ authorizeCredentials } = await import("@/lib/auth"))
    ;({ loginAction } = await import("@/actions/auth"))
    ;({ __resetRateLimit: resetRateLimit } = await import("@/lib/rate-limit"))
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  beforeEach(async () => {
    await truncateDomain(["users"])
    resetRateLimit()
  })

  /** Seed a verified credentials user; returns its id. */
  async function seedLoginUser(
    email: string,
    opts: { totpEnabled?: boolean } = {},
  ): Promise<string> {
    const rows = await sql<{ id: string }[]>`
      INSERT INTO users (email, name, role, password_hash, email_verified, totp_enabled, totp_secret)
      VALUES (
        ${email}, ${email}, 'viewer', ${passwordHash}, now(),
        ${opts.totpEnabled ?? false}, ${opts.totpEnabled ? "JBSWY3DPEHPK3PXP" : null}
      )
      RETURNING id
    `
    return rows[0].id
  }

  /** Read the two lockout columns straight from Postgres (independent conn). */
  async function readLockout(
    id: string,
  ): Promise<{ failed_login_count: number; locked_until: Date | null }> {
    const rows = await sql<{ failed_login_count: number; locked_until: Date | null }[]>`
      SELECT failed_login_count, locked_until FROM users WHERE id = ${id}
    `
    return rows[0]
  }

  /** Ask Postgres (not JS) whether the stored lock is still in the future. */
  async function lockIsInFuture(id: string): Promise<boolean> {
    const rows = await sql<{ future: boolean | null }[]>`
      SELECT locked_until > now() AS future FROM users WHERE id = ${id}
    `
    return rows[0].future === true
  }

  function loginForm(email: string, password: string): FormData {
    const fd = new FormData()
    fd.set("email", email)
    fd.set("password", password)
    return fd
  }

  // ── Path 1 — authorizeCredentials (non-2FA) ──────────────────────────────

  describe("path 1 — lib/auth.ts authorizeCredentials", () => {
    it("persists the counter and the lock after 5 wrong passwords (AC #1, #2)", async () => {
      const email = "lock1@example.com"
      const id = await seedLoginUser(email)

      expect(await readLockout(id)).toEqual({ failed_login_count: 0, locked_until: null })

      for (let i = 1; i <= 4; i++) {
        expect(await authorizeCredentials({ email, password: WRONG })).toBeNull()
        const row = await readLockout(id)
        expect(row.failed_login_count).toBe(i)
        expect(row.locked_until).toBeNull() // not locked below the threshold
      }

      expect(await authorizeCredentials({ email, password: WRONG })).toBeNull()
      const locked = await readLockout(id)
      expect(locked.failed_login_count).toBe(5)
      expect(locked.locked_until).not.toBeNull()
      expect(await lockIsInFuture(id)).toBe(true)

      // 6th attempt — with the CORRECT password — is refused.
      expect(await authorizeCredentials({ email, password: PASSWORD })).toBeNull()
    })

    it("the lock survives a fresh module instance (AC #2 — 'restart')", async () => {
      const email = "restart@example.com"
      const id = await seedLoginUser(email)
      for (let i = 0; i < 5; i++) {
        await authorizeCredentials({ email, password: WRONG })
      }
      expect(await lockIsInFuture(id)).toBe(true)

      // Throw away every module instance — any in-memory counter is gone. Only
      // the DB row remains, which is exactly what the epic is about.
      vi.resetModules()
      const fresh = await import("@/lib/auth")
      expect(await fresh.authorizeCredentials({ email, password: PASSWORD })).toBeNull()

      // …and the row was not mutated by the blocked attempt.
      const row = await readLockout(id)
      expect(row.failed_login_count).toBe(5)
    })

    it("a successful login zeroes the counter and clears the lock (AC #3)", async () => {
      const email = "clear@example.com"
      const id = await seedLoginUser(email)
      await sql`UPDATE users SET failed_login_count = 3 WHERE id = ${id}`

      const res = await authorizeCredentials({ email, password: PASSWORD })
      expect(res).toMatchObject({ id })
      expect(await readLockout(id)).toEqual({ failed_login_count: 0, locked_until: null })
    })

    it("after the window expires the count restarts from 1 (AC #4)", async () => {
      const email = "expired@example.com"
      const id = await seedLoginUser(email)
      await sql`
        UPDATE users SET failed_login_count = 5, locked_until = now() - interval '1 second'
        WHERE id = ${id}
      `

      // Not blocked any more…
      expect(await authorizeCredentials({ email, password: WRONG })).toBeNull()
      // …and the counter restarted rather than continuing at 6.
      const row = await readLockout(id)
      expect(row.failed_login_count).toBe(1)
      expect(row.locked_until).toBeNull()

      // The correct password now works again.
      expect(await authorizeCredentials({ email, password: PASSWORD })).toMatchObject({ id })
    })

    // AC #7 — disabled ⇒ complete no-op, NOTHING written.
    it("ENABLE_LOGIN_LOCKOUT=false: 10 wrong passwords write nothing (AC #7)", async () => {
      const email = "off@example.com"
      const id = await seedLoginUser(email)
      vi.stubEnv("ENABLE_LOGIN_LOCKOUT", "false")

      for (let i = 0; i < 10; i++) {
        expect(await authorizeCredentials({ email, password: WRONG })).toBeNull()
      }

      expect(await readLockout(id)).toEqual({ failed_login_count: 0, locked_until: null })
    })

    // AC #8 — the escape hatch: an EXISTING lock stops blocking, and the stored
    // values are preserved (not cleared) so re-enabling restores the behaviour.
    it("ENABLE_LOGIN_LOCKOUT=false releases an existing lock but keeps the columns (AC #8)", async () => {
      const email = "escape@example.com"
      const id = await seedLoginUser(email)
      await sql`
        UPDATE users SET failed_login_count = 5, locked_until = now() + interval '15 minutes'
        WHERE id = ${id}
      `

      // Enabled → blocked even with the right password.
      vi.stubEnv("ENABLE_LOGIN_LOCKOUT", "true")
      expect(await authorizeCredentials({ email, password: PASSWORD })).toBeNull()

      // Disabled → let straight back in, with NO write.
      vi.stubEnv("ENABLE_LOGIN_LOCKOUT", "false")
      expect(await authorizeCredentials({ email, password: PASSWORD })).toMatchObject({ id })
      const row = await readLockout(id)
      expect(row.failed_login_count).toBe(5) // preserved, not cleared
      expect(row.locked_until).not.toBeNull()
      expect(await lockIsInFuture(id)).toBe(true)

      // Re-enabled → the SAME stored lock blocks again.
      vi.stubEnv("ENABLE_LOGIN_LOCKOUT", "true")
      expect(await authorizeCredentials({ email, password: PASSWORD })).toBeNull()
    })
  })

  // ── Path 2 — loginAction 2FA branch (TOTP users) ─────────────────────────

  describe("path 2 — actions/auth.ts loginAction 2FA branch", () => {
    it("persists the counter and locks a TOTP user after 5 wrong passwords (AC #5)", async () => {
      const email = "totp@example.com"
      const id = await seedLoginUser(email, { totpEnabled: true })

      for (let i = 1; i <= 5; i++) {
        // Clear layer 1 each round so this test measures ONLY the persistent
        // layer — otherwise the in-memory bucket answers first from attempt 6.
        resetRateLimit()
        const res = await loginAction(null, loginForm(email, WRONG))
        expect(res).toEqual({ error: "電子郵件或密碼錯誤。" })
        expect((await readLockout(id)).failed_login_count).toBe(i)
      }

      expect(await lockIsInFuture(id)).toBe(true)

      // 6th attempt with the CORRECT password is refused with the lock message,
      // and never reaches the /login/2fa redirect — even with layer 1 wiped,
      // which is precisely the "survives a restart" property.
      resetRateLimit()
      const res = await loginAction(null, loginForm(email, PASSWORD))
      expect(res?.error).toContain("鎖定")
    })

    it("a TOTP user's correct password clears the counter (AC #3, path 2)", async () => {
      const email = "totpclear@example.com"
      const id = await seedLoginUser(email, { totpEnabled: true })
      await sql`UPDATE users SET failed_login_count = 3 WHERE id = ${id}`

      // The 2FA branch ends in redirect("/login/2fa") — our mock throws it.
      await expect(loginAction(null, loginForm(email, PASSWORD))).rejects.toThrow(
        "__REDIRECT__:/login/2fa",
      )

      expect(await readLockout(id)).toEqual({ failed_login_count: 0, locked_until: null })
    })

    it("ENABLE_LOGIN_LOCKOUT=false: a TOTP user's 10 misses write nothing (AC #7, path 2)", async () => {
      const email = "totpoff@example.com"
      const id = await seedLoginUser(email, { totpEnabled: true })
      vi.stubEnv("ENABLE_LOGIN_LOCKOUT", "false")

      for (let i = 0; i < 10; i++) {
        resetRateLimit() // isolate layer 2 (see above)
        expect(await loginAction(null, loginForm(email, WRONG))).toEqual({
          error: "電子郵件或密碼錯誤。",
        })
      }

      expect(await readLockout(id)).toEqual({ failed_login_count: 0, locked_until: null })
    })
  })
})
