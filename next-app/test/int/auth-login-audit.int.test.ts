/**
 * auth-login-audit.int.test.ts — E356 login audit events against a REAL
 * throwaway Postgres DB.
 *
 * The unit tests (lib/auth.test.ts, actions/auth.test.ts) prove that logAudit()
 * is CALLED with the right action on each branch, using a mocked audit module.
 * A mock cannot prove the thing this epic's most valuable acceptance criterion
 * is actually about:
 *
 *   AC #4 — a failed login for a NONEXISTENT email must write NO audit row.
 *
 * That is a claim about ROWS IN A TABLE, and the only honest way to assert it is
 * to count them in a real database. A mocked `logAudit` that is simply never
 * called looks identical to a `logAudit` that is called and silently swallows
 * its insert — and the whole point of the policy is that the audit table cannot
 * be grown by an unauthenticated caller (account enumeration / log flooding).
 *
 * Both password paths are covered, mirroring auth-lockout.int.test.ts:
 *   path 1 — lib/auth.ts `authorizeCredentials` (non-2FA users)
 *   path 2 — actions/auth.ts `loginAction` (the lockout pre-check + the 2FA branch)
 *
 * Follows the harness ordering trap: setupTestDb() in beforeAll BEFORE any
 * dynamic import of @/lib/db or a module that pulls it in.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { isPostgresReachable, setupTestDb, teardownTestDb, truncateDomain } from "./harness"

const reachable = await isPostgresReachable()
if (!reachable) {
  console.warn(
    "⏭ SKIP next-app/test/int/auth-login-audit.int.test.ts — no reachable Postgres. " +
      "Start it with `docker compose up -d postgres` (repo root) or set TEST_DATABASE_URL, then re-run `pnpm test:int`.",
  )
}

// Same stubs as auth-lockout.int.test.ts: loginAction needs a request scope for
// headers()/redirect() and must not complete a real NextAuth sign-in. @/lib/auth
// is deliberately NOT mocked — `authorizeCredentials` is the code under test.
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
vi.mock("@/lib/pending-2fa", () => ({
  setPending2fa: async () => {},
  readPending2fa: async () => null,
  clearPending2fa: async () => {},
  issueNonce: () => "nonce",
  consumeNonce: () => null,
}))

process.env.AUTH_SECRET ??= "integration-test-secret-at-least-32-chars-long"

const PASSWORD = "Correct1234"
const WRONG = "Wrong1234"

describe.skipIf(!reachable)("E356 login audit events — real DB", () => {
  let sql: Awaited<ReturnType<typeof setupTestDb>>["sql"]
  let authorizeCredentials: (creds: Record<string, unknown>) => Promise<{ id: string } | null>
  let loginAction: typeof import("@/actions/auth").loginAction
  let passwordHash: string
  let resetRateLimit: () => void

  beforeAll(async () => {
    const testDb = await setupTestDb()
    sql = testDb.sql

    const password = await import("@/lib/password")
    passwordHash = await password.hashPassword(PASSWORD)
    ;({ authorizeCredentials } = await import("@/lib/auth"))
    ;({ loginAction } = await import("@/actions/auth"))
    ;({ __resetRateLimit: resetRateLimit } = await import("@/lib/rate-limit"))
  }, 120_000)

  afterAll(async () => {
    await teardownTestDb()
  })

  beforeEach(async () => {
    await truncateDomain(["audit_log", "users"])
    resetRateLimit()
  })

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

  /** EVERY audit row, oldest first — the count assertion AC #4 is written against. */
  async function allAudit(): Promise<
    { action: string; actor_id: string | null; target_id: string | null; on_behalf: boolean }[]
  > {
    return sql<
      { action: string; actor_id: string | null; target_id: string | null; on_behalf: boolean }[]
    >`SELECT action, actor_id, target_id, on_behalf FROM audit_log ORDER BY created_at, action`
  }

  async function auditActions(): Promise<string[]> {
    return (await allAudit()).map((r) => r.action)
  }

  async function auditRowCount(): Promise<number> {
    const rows = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM audit_log`
    return rows[0].n
  }

  function loginForm(email: string, password: string): FormData {
    const fd = new FormData()
    fd.set("email", email)
    fd.set("password", password)
    return fd
  }

  // ── AC #4 — the security policy ────────────────────────────────────────────

  describe("AC #4 — a nonexistent email writes NOTHING", () => {
    it("authorizeCredentials: 10 attempts on unknown emails leave audit_log EMPTY", async () => {
      expect(await auditRowCount()).toBe(0)

      for (let i = 0; i < 10; i++) {
        expect(
          await authorizeCredentials({ email: `ghost${i}@nowhere.test`, password: WRONG }),
        ).toBeNull()
      }

      // The whole point: an unauthenticated caller cannot grow this table.
      expect(await auditRowCount()).toBe(0)
    })

    it("loginAction: 10 attempts on unknown emails leave audit_log EMPTY", async () => {
      for (let i = 0; i < 10; i++) {
        resetRateLimit()
        await loginAction(null, loginForm(`ghost${i}@nowhere.test`, WRONG))
      }

      expect(await auditRowCount()).toBe(0)
    })

    it("an UNVERIFIED account also writes nothing (refused before any password check)", async () => {
      const email = "unverified@int.test"
      await sql`
        INSERT INTO users (email, name, role, password_hash, email_verified)
        VALUES (${email}, ${email}, 'viewer', ${passwordHash}, NULL)
      `

      expect(await authorizeCredentials({ email, password: PASSWORD })).toBeNull()
      expect(await loginAction(null, loginForm(email, PASSWORD))).toMatchObject({
        error: expect.any(String),
      })

      expect(await auditRowCount()).toBe(0)
    })
  })

  // ── AC #3 — the three events, path 1 ───────────────────────────────────────

  describe("path 1 — lib/auth.ts authorizeCredentials", () => {
    it("a successful login writes exactly one auth.login attributed to the user", async () => {
      const email = "ok@int.test"
      const id = await seedLoginUser(email)

      expect(await authorizeCredentials({ email, password: PASSWORD })).toMatchObject({ id })

      const rows = await allAudit()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        action: "auth.login",
        actor_id: id,
        target_id: id,
        on_behalf: false, // a login is always the user's OWN action
      })
    })

    it("a wrong password writes auth.login_failed (and nothing else) below the threshold", async () => {
      const email = "bad@int.test"
      const id = await seedLoginUser(email)

      expect(await authorizeCredentials({ email, password: WRONG })).toBeNull()

      const rows = await allAudit()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ action: "auth.login_failed", actor_id: id })
    })

    it("the 5th failure writes auth.login_failed AND auth.locked; the 6th writes auth.locked", async () => {
      const email = "trip@int.test"
      await seedLoginUser(email)

      for (let i = 0; i < 4; i++) {
        await authorizeCredentials({ email, password: WRONG })
      }
      expect(await auditActions()).toEqual([
        "auth.login_failed",
        "auth.login_failed",
        "auth.login_failed",
        "auth.login_failed",
      ])

      // 5th miss trips the persistent lock (E355) — both events are recorded.
      await authorizeCredentials({ email, password: WRONG })
      const afterTrip = await auditActions()
      expect(afterTrip.filter((a) => a === "auth.login_failed")).toHaveLength(5)
      expect(afterTrip.filter((a) => a === "auth.locked")).toHaveLength(1)

      // 6th attempt hits the already-locked gate — even with the RIGHT password.
      expect(await authorizeCredentials({ email, password: PASSWORD })).toBeNull()
      const afterBlocked = await auditActions()
      expect(afterBlocked.filter((a) => a === "auth.locked")).toHaveLength(2)
      expect(afterBlocked.filter((a) => a === "auth.login")).toHaveLength(0)
    })
  })

  // ── AC #3 — path 2 (TOTP users) ────────────────────────────────────────────

  describe("path 2 — actions/auth.ts loginAction", () => {
    it("a TOTP user's wrong password writes auth.login_failed (authorize never sees it)", async () => {
      const email = "totp@int.test"
      const id = await seedLoginUser(email, { totpEnabled: true })

      expect(await loginAction(null, loginForm(email, WRONG))).toEqual({
        error: "電子郵件或密碼錯誤。",
      })

      const rows = await allAudit()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ action: "auth.login_failed", actor_id: id })
    })

    it("a TOTP user's correct password writes NO event yet (no session created)", async () => {
      const email = "totp2@int.test"
      await seedLoginUser(email, { totpEnabled: true })

      await expect(loginAction(null, loginForm(email, PASSWORD))).rejects.toThrow(
        "__REDIRECT__:/login/2fa",
      )

      // The challenge has not been passed — logging auth.login here would record
      // a "successful login" that never happened.
      expect(await auditRowCount()).toBe(0)
    })

    it("the locked pre-check writes exactly ONE auth.locked (no double-write via signIn)", async () => {
      const email = "locked@int.test"
      const id = await seedLoginUser(email)
      await sql`
        UPDATE users SET failed_login_count = 5, locked_until = now() + interval '15 minutes'
        WHERE id = ${id}
      `

      const res = await loginAction(null, loginForm(email, PASSWORD))
      expect(res?.error).toContain("鎖定")

      const rows = await allAudit()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ action: "auth.locked", actor_id: id })
    })
  })
})
