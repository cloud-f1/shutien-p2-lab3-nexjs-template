/**
 * E355 — WIRING test for persistent login lockout on PATH 1:
 * `authorizeCredentials` in lib/auth.ts (the Credentials `authorize`), which is
 * the password path taken by users WITHOUT 2FA.
 *
 * The pure arithmetic is unit-tested in auth-utils.test.ts. This file proves the
 * other half of "wire what you test": that the real login path actually calls
 * isLocked / nextFailedState / clearedLoginState and PERSISTS the result. A
 * tested pure function with no caller is a known failure mode in this repo.
 *
 * Path 2 (the 2FA branch of loginAction, where TOTP users' passwords are
 * verified) is covered in actions/auth.test.ts — both are required, since
 * authorize() never sees a TOTP user's password.
 *
 * lib/auth.ts pulls in NextAuth + the Drizzle adapter + @/lib/db (which throws
 * without DATABASE_URL), so those are mocked so the module loads. auth-utils is
 * deliberately NOT mocked — we want the REAL pure functions exercised through
 * the production wiring.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// --- Mocks (declared before importing the SUT) -----------------------------

vi.mock("next-auth", () => ({
  default: () => ({
    auth: vi.fn(),
    handlers: {},
    signIn: vi.fn(),
    signOut: vi.fn(),
    unstable_update: vi.fn(),
  }),
}))
// Provider factories are passthroughs — we call authorizeCredentials directly.
vi.mock("next-auth/providers/credentials", () => ({ default: (cfg: unknown) => cfg }))
vi.mock("next-auth/providers/google", () => ({ default: (cfg: unknown) => cfg }))
vi.mock("next-auth/providers/github", () => ({ default: (cfg: unknown) => cfg }))
vi.mock("@auth/drizzle-adapter", () => ({ DrizzleAdapter: () => ({}) }))
vi.mock("../auth.config", () => ({ authConfig: { callbacks: {} } }))

const mockGetUserByEmail = vi.fn()
const mockGetUserById = vi.fn()
vi.mock("./queries", () => ({
  getUserByEmail: (...a: unknown[]) => mockGetUserByEmail(...a),
  getUserById: (...a: unknown[]) => mockGetUserById(...a),
}))

const mockComparePassword = vi.fn()
vi.mock("./password", () => ({
  comparePassword: (...a: unknown[]) => mockComparePassword(...a),
}))

const mockConsumeNonce = vi.fn()
vi.mock("./pending-2fa", () => ({
  consumeNonce: (...a: unknown[]) => mockConsumeNonce(...a),
}))

// DB mock — capture the `.set(...)` payload of every update().set().where() call.
const dbUpdates: Record<string, unknown>[] = []
vi.mock("./db", () => ({
  db: {
    update: () => ({
      set: (vals: Record<string, unknown>) => ({
        where: async () => {
          dbUpdates.push(vals)
          return []
        },
      }),
    }),
  },
}))

vi.mock("./schema", () => ({
  usersTable: { id: "id" },
  accountsTable: {},
  sessionsTable: {},
  verificationTokensTable: {},
}))

// E356 — capture every audit event written during a login attempt. Mocked (not
// left real) for two reasons: the `db` stub above has no `.insert`, and the
// point of these tests is WHICH event each branch emits, not the DB write —
// that is proven against a real table in test/int/auth-login-audit.int.test.ts.
const mockLogAudit = vi.fn()
vi.mock("./audit", () => ({
  logAudit: (...a: unknown[]) => mockLogAudit(...a),
}))

vi.mock("drizzle-orm", () => ({ eq: (...a: unknown[]) => ({ __eq: a }) }))

// --- Import the SUT after mocks --------------------------------------------

import { authorizeCredentials } from "./auth"
import { LOCKOUT_DURATION_MS, MAX_FAILED_LOGIN_ATTEMPTS } from "./auth-utils"

const verifiedUser = (over: Record<string, unknown> = {}) => ({
  id: "user_1",
  email: "ada@example.com",
  name: "Ada",
  image: null,
  role: "viewer",
  passwordHash: "hash",
  emailVerified: new Date("2026-01-01T00:00:00.000Z"),
  totpEnabled: false,
  failedLoginCount: 0,
  lockedUntil: null,
  ...over,
})

const creds = (over: Record<string, unknown> = {}) => ({
  email: "ada@example.com",
  password: "Correct1234",
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  dbUpdates.length = 0
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("authorizeCredentials — persistent lockout wiring (E355, path 1)", () => {
  // Acceptance #1 — locked ⇒ blocked, and bcrypt is never reached.
  it("rejects a locked account WITHOUT comparing the password (isLocked wired)", async () => {
    const lockedUntil = new Date(Date.now() + 60_000)
    mockGetUserByEmail.mockResolvedValue(
      verifiedUser({ failedLoginCount: MAX_FAILED_LOGIN_ATTEMPTS, lockedUntil }),
    )

    const res = await authorizeCredentials(creds())

    expect(res).toBeNull()
    expect(mockComparePassword).not.toHaveBeenCalled() // blocked BEFORE bcrypt
    expect(dbUpdates).toHaveLength(0)
  })

  it("increments the failure counter on a wrong password (nextFailedState wired)", async () => {
    mockGetUserByEmail.mockResolvedValue(verifiedUser({ failedLoginCount: 1 }))
    mockComparePassword.mockResolvedValue(false)

    const res = await authorizeCredentials(creds({ password: "wrong" }))

    expect(res).toBeNull()
    expect(dbUpdates).toHaveLength(1)
    expect(dbUpdates[0]).toEqual({ failedLoginCount: 2, lockedUntil: null })
  })

  it("sets lockedUntil on the 5th consecutive wrong password", async () => {
    mockGetUserByEmail.mockResolvedValue(
      verifiedUser({ failedLoginCount: MAX_FAILED_LOGIN_ATTEMPTS - 1 }),
    )
    mockComparePassword.mockResolvedValue(false)

    const before = Date.now()
    const res = await authorizeCredentials(creds({ password: "wrong" }))
    const after = Date.now()

    expect(res).toBeNull()
    expect(dbUpdates[0].failedLoginCount).toBe(MAX_FAILED_LOGIN_ATTEMPTS)
    const lockedUntil = dbUpdates[0].lockedUntil as Date
    expect(lockedUntil).toBeInstanceOf(Date)
    expect(lockedUntil.getTime()).toBeGreaterThanOrEqual(before + LOCKOUT_DURATION_MS)
    expect(lockedUntil.getTime()).toBeLessThanOrEqual(after + LOCKOUT_DURATION_MS)
  })

  // Acceptance #1 end-to-end through the wiring: 5 misses then a 6th blocked
  // attempt, with the persisted state fed back in between (as a real request
  // sequence would re-read it from the DB).
  it("blocks the 6th attempt after 5 misses, without bcrypt (full sequence)", async () => {
    let row = verifiedUser()
    mockComparePassword.mockResolvedValue(false)

    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
      mockGetUserByEmail.mockResolvedValue(row)
      await authorizeCredentials(creds({ password: "wrong" }))
      row = verifiedUser(dbUpdates[dbUpdates.length - 1]) // persist → next request
    }

    expect(mockComparePassword).toHaveBeenCalledTimes(MAX_FAILED_LOGIN_ATTEMPTS)
    expect(dbUpdates).toHaveLength(MAX_FAILED_LOGIN_ATTEMPTS)

    // 6th attempt — even with the CORRECT password.
    mockComparePassword.mockClear()
    mockComparePassword.mockResolvedValue(true)
    mockGetUserByEmail.mockResolvedValue(row)
    const res = await authorizeCredentials(creds())

    expect(res).toBeNull()
    expect(mockComparePassword).not.toHaveBeenCalled()
  })

  // Acceptance #3
  it("clears the counter/lock on a successful login (clearedLoginState wired)", async () => {
    mockGetUserByEmail.mockResolvedValue(verifiedUser({ failedLoginCount: 3 }))
    mockComparePassword.mockResolvedValue(true)

    const res = await authorizeCredentials(creds())

    expect(res).toMatchObject({ id: "user_1", email: "ada@example.com", role: "viewer" })
    expect(dbUpdates).toEqual([{ failedLoginCount: 0, lockedUntil: null }])
  })

  it("does NOT write on a clean login when there were no prior failures", async () => {
    mockGetUserByEmail.mockResolvedValue(verifiedUser())
    mockComparePassword.mockResolvedValue(true)

    const res = await authorizeCredentials(creds())

    expect(res).toMatchObject({ id: "user_1" })
    expect(dbUpdates).toHaveLength(0) // no needless UPDATE
  })

  // Acceptance #4 — an expired lock restarts the count instead of continuing it.
  it("restarts the count after an expired lock (counter back to 1, no lock)", async () => {
    mockGetUserByEmail.mockResolvedValue(
      verifiedUser({
        failedLoginCount: MAX_FAILED_LOGIN_ATTEMPTS,
        lockedUntil: new Date(Date.now() - 1000),
      }),
    )
    mockComparePassword.mockResolvedValue(false)

    await authorizeCredentials(creds({ password: "wrong" }))

    expect(mockComparePassword).toHaveBeenCalledTimes(1) // expired ⇒ not blocked
    expect(dbUpdates[0]).toEqual({ failedLoginCount: 1, lockedUntil: null })
  })

  it("rejects an unverified user before touching the lockout logic", async () => {
    mockGetUserByEmail.mockResolvedValue(verifiedUser({ emailVerified: null }))

    const res = await authorizeCredentials(creds())

    expect(res).toBeNull()
    expect(mockComparePassword).not.toHaveBeenCalled()
    expect(dbUpdates).toHaveLength(0)
  })

  it("leaves the nonce (2FA completion) path untouched — no lockout writes", async () => {
    mockConsumeNonce.mockReturnValue("user_1")
    mockGetUserById.mockResolvedValue(verifiedUser({ totpEnabled: true, failedLoginCount: 4 }))

    const res = await authorizeCredentials({ totpNonce: "nonce-abc" })

    expect(res).toMatchObject({ id: "user_1" })
    expect(mockComparePassword).not.toHaveBeenCalled()
    expect(dbUpdates).toHaveLength(0)
  })
})

// Acceptance #7 / #8 — the escape hatch, at the wiring level.
describe("authorizeCredentials — ENABLE_LOGIN_LOCKOUT=false is a complete no-op", () => {
  beforeEach(() => {
    vi.stubEnv("ENABLE_LOGIN_LOCKOUT", "false")
  })

  it("writes NOTHING after 10 consecutive wrong passwords", async () => {
    mockGetUserByEmail.mockResolvedValue(verifiedUser())
    mockComparePassword.mockResolvedValue(false)

    for (let i = 0; i < 10; i++) {
      expect(await authorizeCredentials(creds({ password: "wrong" }))).toBeNull()
    }

    expect(mockComparePassword).toHaveBeenCalledTimes(10) // never short-circuited
    expect(dbUpdates).toHaveLength(0) // and never persisted
  })

  it("lets an ALREADY-locked account through (escape hatch), without clearing the columns", async () => {
    const lockedUntil = new Date(Date.now() + 15 * 60 * 1000)
    mockGetUserByEmail.mockResolvedValue(
      verifiedUser({ failedLoginCount: MAX_FAILED_LOGIN_ATTEMPTS, lockedUntil }),
    )
    mockComparePassword.mockResolvedValue(true)

    const res = await authorizeCredentials(creds())

    expect(res).toMatchObject({ id: "user_1" })
    // the stored lock is IGNORED, not erased — no DB write at all
    expect(dbUpdates).toHaveLength(0)
  })

  it("re-enabling the flag makes the SAME stored lock block again", async () => {
    const lockedUntil = new Date(Date.now() + 15 * 60 * 1000)
    mockGetUserByEmail.mockResolvedValue(
      verifiedUser({ failedLoginCount: MAX_FAILED_LOGIN_ATTEMPTS, lockedUntil }),
    )
    mockComparePassword.mockResolvedValue(true)

    vi.stubEnv("ENABLE_LOGIN_LOCKOUT", "true")
    const res = await authorizeCredentials(creds())

    expect(res).toBeNull()
    expect(mockComparePassword).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// E356 — login audit events on PATH 1. These assert WHICH event each branch of
// authorizeCredentials emits. The "nonexistent email writes nothing" policy is
// asserted here AND, with a real row count, in
// test/int/auth-login-audit.int.test.ts — a mock that is simply never called
// cannot distinguish "no row written" from "write attempted and swallowed".
// ---------------------------------------------------------------------------
describe("authorizeCredentials — login audit events (E356, path 1)", () => {
  /** The `action` of every logAudit call, in order. */
  const auditedActions = () =>
    mockLogAudit.mock.calls.map((c) => (c[0] as { action: string }).action)

  it("writes auth.login on a successful login, attributed to the user", async () => {
    mockGetUserByEmail.mockResolvedValue(verifiedUser())
    mockComparePassword.mockResolvedValue(true)

    await authorizeCredentials(creds())

    expect(auditedActions()).toEqual(["auth.login"])
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.login",
        actorId: "user_1",
        targetType: "user",
        targetId: "user_1",
      }),
    )
  })

  it("writes auth.login_failed ONLY on a wrong password below the lock threshold", async () => {
    mockGetUserByEmail.mockResolvedValue(verifiedUser({ failedLoginCount: 1 }))
    mockComparePassword.mockResolvedValue(false)

    await authorizeCredentials(creds({ password: "wrong" }))

    expect(auditedActions()).toEqual(["auth.login_failed"])
  })

  it("writes BOTH auth.login_failed and auth.locked when the 5th failure trips the lock", async () => {
    mockGetUserByEmail.mockResolvedValue(
      verifiedUser({ failedLoginCount: MAX_FAILED_LOGIN_ATTEMPTS - 1 }),
    )
    mockComparePassword.mockResolvedValue(false)

    await authorizeCredentials(creds({ password: "wrong" }))

    expect(auditedActions()).toEqual(["auth.login_failed", "auth.locked"])
  })

  it("writes auth.locked when an ALREADY-locked account attempts to log in", async () => {
    mockGetUserByEmail.mockResolvedValue(
      verifiedUser({
        failedLoginCount: MAX_FAILED_LOGIN_ATTEMPTS,
        lockedUntil: new Date(Date.now() + 60_000),
      }),
    )

    await authorizeCredentials(creds())

    expect(auditedActions()).toEqual(["auth.locked"])
    // E355's ordering invariant is intact: the audit write did not move the
    // lock check to after bcrypt.
    expect(mockComparePassword).not.toHaveBeenCalled()
  })

  // THE policy criterion (AC #4).
  it("writes NO audit event for a NONEXISTENT email (no user row to attribute)", async () => {
    mockGetUserByEmail.mockResolvedValue(null)

    const res = await authorizeCredentials(creds({ email: "ghost@example.com" }))

    expect(res).toBeNull()
    expect(mockLogAudit).not.toHaveBeenCalled()
  })

  it("writes NO audit event for an unverified account (refused before any password check)", async () => {
    mockGetUserByEmail.mockResolvedValue(verifiedUser({ emailVerified: null }))

    await authorizeCredentials(creds())

    expect(mockLogAudit).not.toHaveBeenCalled()
  })

  it("writes NO audit event when a TOTP user is routed to the /login/2fa challenge", async () => {
    mockGetUserByEmail.mockResolvedValue(verifiedUser({ totpEnabled: true }))
    mockComparePassword.mockResolvedValue(true)

    const res = await authorizeCredentials(creds())

    expect(res).toBeNull() // no session created yet
    expect(mockLogAudit).not.toHaveBeenCalled()
  })

  it("writes auth.login on the nonce path — where a TOTP user's session IS created", async () => {
    mockConsumeNonce.mockReturnValue("user_1")
    mockGetUserById.mockResolvedValue(verifiedUser({ totpEnabled: true }))

    const res = await authorizeCredentials({ totpNonce: "nonce-abc" })

    expect(res).toMatchObject({ id: "user_1" })
    expect(auditedActions()).toEqual(["auth.login"])
  })

  it("writes auth.login_failed with NO lock event while ENABLE_LOGIN_LOCKOUT=false", async () => {
    vi.stubEnv("ENABLE_LOGIN_LOCKOUT", "false")
    mockGetUserByEmail.mockResolvedValue(
      verifiedUser({ failedLoginCount: MAX_FAILED_LOGIN_ATTEMPTS - 1 }),
    )
    mockComparePassword.mockResolvedValue(false)

    await authorizeCredentials(creds({ password: "wrong" }))

    // The escape hatch stays a complete no-op for the LOCK; the failure itself
    // is still auditable.
    expect(auditedActions()).toEqual(["auth.login_failed"])
    expect(dbUpdates).toHaveLength(0)
  })
})
