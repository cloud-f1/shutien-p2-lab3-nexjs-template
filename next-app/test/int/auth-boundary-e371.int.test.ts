/**
 * auth-boundary-e371.int.test.ts — E371.
 *
 * Four auth-boundary gaps that share the same wiring points:
 *   F5  guest checkout pre-stamped `emailVerified` for an UNPROVEN address
 *   F2  resetPassword never cleared the E355 lockout state
 *   F8  resendVerificationEmail leaked account existence
 *   F10 the 2FA challenge had only the in-memory limiter, not E355's DB columns
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { isPostgresReachable, setupTestDb, teardownTestDb, truncateDomain, type TestDb } from "./harness"

const reachable = await isPostgresReachable()
if (!reachable) {
  console.warn("⏭ SKIP next-app/test/int/auth-boundary-e371.int.test.ts — no reachable Postgres.")
}

let pendingUserId: string | null = null
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
  readPending2fa: async () => pendingUserId,
  clearPending2fa: async () => {},
  issueNonce: () => "nonce",
}))
const sendVerificationEmail = vi.fn(async () => {})
const sendPasswordResetEmail = vi.fn(async () => {})
vi.mock("@/lib/email", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  sendVerificationEmail,
  sendPasswordResetEmail,
}))

process.env.AUTH_SECRET ??= "integration-test-secret-at-least-32-chars-long"

describe.skipIf(!reachable)("E371 — auth boundary closure", () => {
  let tdb: TestDb
  let auth: typeof import("@/actions/auth")
  let provisionUserForOrder: typeof import("@/lib/auth-provision").provisionUserForOrder

  beforeAll(async () => {
    tdb = await setupTestDb()
    auth = await import("@/actions/auth")
    ;({ provisionUserForOrder } = await import("@/lib/auth-provision"))
  })
  afterAll(async () => teardownTestDb())
  beforeEach(() => {
    vi.stubEnv("ENABLE_LOGIN_LOCKOUT", "true")
    sendVerificationEmail.mockClear()
    pendingUserId = null
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    await truncateDomain(["password_reset_tokens", "email_verification_tokens", "audit_log", "users"])
  })

  const readUser = async (id: string) =>
    (
      await tdb.sql<
        { email_verified: Date | null; failed_login_count: number; locked_until: Date | null }[]
      >`SELECT email_verified, failed_login_count, locked_until FROM users WHERE id = ${id}`
    )[0]

  // ── F5 ────────────────────────────────────────────────────────────────────
  it("AC1 — guest checkout does NOT pre-verify the purchase email", async () => {
    const { userId, activationToken } = await provisionUserForOrder("victim@e371.test", "Victim")
    expect((await readUser(userId)).email_verified).toBeNull()

    // ...and redeeming the activation link is what stamps it.
    expect(activationToken).toBeTruthy()
    const res = await auth.resetPassword(activationToken!, "BrandNew1234")
    expect(res.success).toBe(true)
    expect((await readUser(userId)).email_verified).not.toBeNull()
  })

  it("AC2 — a squatted address can still self-register, and DOES get a mail", async () => {
    // An attacker buys the cheapest product using the victim's address.
    const { userId } = await provisionUserForOrder("victim2@e371.test", null)
    sendVerificationEmail.mockClear()

    // The victim later registers. Before E371 this took the "already exists →
    // skip insert" branch: no mail, no error, and an eternal wait on
    // /verify-email — the address was burned.
    const fd = new FormData()
    fd.set("name", "Real Victim")
    fd.set("email", "victim2@e371.test")
    fd.set("password", "VictimPass1234")
    await expect(auth.registerUser({}, fd)).rejects.toThrow(/__REDIRECT__/)

    expect(sendVerificationEmail).toHaveBeenCalledTimes(1)
    // ...and it claimed the SAME row rather than creating a duplicate.
    const rows = await tdb.sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM users WHERE email = 'victim2@e371.test'`
    expect(rows[0].n).toBe(1)
    const [claimed] = await tdb.sql<{ password_hash: string | null; name: string }[]>`
      SELECT password_hash, name FROM users WHERE id = ${userId}`
    expect(claimed.password_hash).not.toBeNull()
    expect(claimed.name).toBe("Real Victim")
  })

  it("AC2b — a REAL account is still never claimed by a re-registration", async () => {
    const [u] = await tdb.sql<{ id: string }[]>`
      INSERT INTO users (email, name, password_hash, email_verified)
      VALUES ('real@e371.test', 'Real', 'original-hash', now()) RETURNING id`
    sendVerificationEmail.mockClear()

    const fd = new FormData()
    fd.set("name", "Impostor")
    fd.set("email", "real@e371.test")
    fd.set("password", "ImpostorPass1234")
    await expect(auth.registerUser({}, fd)).rejects.toThrow(/__REDIRECT__/)

    // Untouched — and no mail, exactly as before.
    const [after] = await tdb.sql<{ password_hash: string; name: string }[]>`
      SELECT password_hash, name FROM users WHERE id = ${u.id}`
    expect(after.password_hash).toBe("original-hash")
    expect(after.name).toBe("Real")
    expect(sendVerificationEmail).not.toHaveBeenCalled()
  })

  // ── F2 ────────────────────────────────────────────────────────────────────
  it("AC3 — resetPassword clears an active lockout", async () => {
    const [u] = await tdb.sql<{ id: string }[]>`
      INSERT INTO users (email, name, password_hash, email_verified, failed_login_count, locked_until)
      VALUES ('locked@e371.test', 'L', 'x', now(), 5, now() + interval '15 minutes')
      RETURNING id`
    const [tok] = await tdb.sql<{ token: string }[]>`
      INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES (${u.id}, 'e371-reset-token', now() + interval '1 hour')
      RETURNING token`

    const res = await auth.resetPassword(tok.token, "BrandNew1234")
    expect(res.success).toBe(true)
    const after = await readUser(u.id)
    expect(after.locked_until).toBeNull()
    expect(after.failed_login_count).toBe(0)
  })

  // ── F8 ────────────────────────────────────────────────────────────────────
  it("AC4 — resendVerificationEmail is byte-identical across all four inputs", async () => {
    await tdb.sql`INSERT INTO users (email, name, password_hash, email_verified)
                  VALUES ('verified@e371.test', 'V', 'x', now())`
    await tdb.sql`INSERT INTO users (email, name, password_hash, email_verified)
                  VALUES ('unverified@e371.test', 'U', 'x', null)`
    await tdb.sql`INSERT INTO users (email, name, password_hash, email_verified)
                  VALUES ('oauth@e371.test', 'O', null, now())`

    const results = await Promise.all([
      auth.resendVerificationEmail("nobody@e371.test"),
      auth.resendVerificationEmail("oauth@e371.test"),
      auth.resendVerificationEmail("verified@e371.test"),
      auth.resendVerificationEmail("unverified@e371.test"),
    ])
    const serialized = results.map((r) => JSON.stringify(r))
    expect(new Set(serialized).size).toBe(1)
    expect(serialized[0]).toBe(JSON.stringify({ success: true }))
  })

  // ── F10 ───────────────────────────────────────────────────────────────────
  it("AC5 — repeated wrong TOTP codes persist a lock in the DB", async () => {
    const [u] = await tdb.sql<{ id: string }[]>`
      INSERT INTO users (email, name, password_hash, email_verified, totp_enabled, totp_secret)
      VALUES ('totp@e371.test', 'T', 'x', now(), true, 'XHTAPSCTAXL7AXO3EGWSAYGFEAQ7DLW7')
      RETURNING id`
    pendingUserId = u.id

    for (let i = 0; i < 5; i++) {
      const fd = new FormData()
      fd.set("token", "000000")
      await auth.verifyTotpLogin(null, fd)
    }
    const after = await readUser(u.id)
    expect(after.failed_login_count).toBeGreaterThanOrEqual(5)
    expect(after.locked_until).not.toBeNull() // ← persisted, survives a restart
  })

  it("AC5b — ENABLE_LOGIN_LOCKOUT=false writes nothing at all", async () => {
    vi.stubEnv("ENABLE_LOGIN_LOCKOUT", "false")
    const [u] = await tdb.sql<{ id: string }[]>`
      INSERT INTO users (email, name, password_hash, email_verified, totp_enabled, totp_secret)
      VALUES ('totp2@e371.test', 'T2', 'x', now(), true, 'XHTAPSCTAXL7AXO3EGWSAYGFEAQ7DLW7')
      RETURNING id`
    pendingUserId = u.id

    for (let i = 0; i < 8; i++) {
      const fd = new FormData()
      fd.set("token", "000000")
      await auth.verifyTotpLogin(null, fd)
    }
    const after = await readUser(u.id)
    expect(after.failed_login_count).toBe(0)
    expect(after.locked_until).toBeNull()
  })
})
