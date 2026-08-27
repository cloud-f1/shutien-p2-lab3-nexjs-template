/**
 * E290 — password-reset server-action integration tests.
 *
 * The action imports @/lib/db (throws without DATABASE_URL) and @/lib/auth
 * (Node-only adapter), so we mock the DB layer, the query helpers, the email
 * transport, the password hasher, and rate-limit — exercising the action's
 * ORCHESTRATION (non-enumeration, token mint/consume) without a real database
 * or SMTP server.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// --- Mocks (declared before importing the SUT) -----------------------------

// next/headers, next/navigation, @/lib/auth are pulled in by actions/auth.ts but
// not exercised by the reset actions — stub them so the module loads.
const mockSignIn = vi.fn()
vi.mock("@/lib/auth", () => ({ signIn: (...a: unknown[]) => mockSignIn(...a), signOut: vi.fn() }))
vi.mock("next/headers", () => ({ headers: async () => new Map(), cookies: vi.fn() }))
const mockRedirect = vi.fn()
vi.mock("next/navigation", () => ({
  redirect: (...a: unknown[]) => mockRedirect(...a),
  unstable_rethrow: vi.fn(),
}))

const mockGetUserByEmail = vi.fn()
const mockGetPasswordResetToken = vi.fn()
vi.mock("@/lib/queries", () => ({
  getUserByEmail: (...a: unknown[]) => mockGetUserByEmail(...a),
  getUserById: vi.fn(),
  getVerificationToken: vi.fn(),
  getPasswordResetToken: (...a: unknown[]) => mockGetPasswordResetToken(...a),
}))

// 2FA plumbing pulled in by actions/auth.ts — stubbed so the module loads and so
// the 2FA login branch can be driven without cookies/otplib.
const mockSetPending2fa = vi.fn()
vi.mock("@/lib/pending-2fa", () => ({
  setPending2fa: (...a: unknown[]) => mockSetPending2fa(...a),
  readPending2fa: vi.fn(),
  clearPending2fa: vi.fn(),
  issueNonce: vi.fn(),
}))
vi.mock("@/lib/totp-utils", () => ({
  verifyToken: vi.fn(),
  verifyBackupCode: vi.fn(),
}))

const mockSendVerificationEmail = vi.fn()
const mockSendPasswordResetEmail = vi.fn()
vi.mock("@/lib/email", () => ({
  sendVerificationEmail: (...a: unknown[]) => mockSendVerificationEmail(...a),
  sendPasswordResetEmail: (...a: unknown[]) => mockSendPasswordResetEmail(...a),
}))

const mockHashPassword = vi.fn()
const mockComparePassword = vi.fn()
vi.mock("@/lib/password", () => ({
  hashPassword: (...a: unknown[]) => mockHashPassword(...a),
  comparePassword: (...a: unknown[]) => mockComparePassword(...a),
}))

// Rate-limit: default to "allowed". cooldown() controls the request flow.
const mockCooldown = vi.fn()
const mockRecordFailure = vi.fn()
vi.mock("@/lib/rate-limit", () => ({
  isRateLimited: () => ({ ok: true }),
  recordFailure: (...a: unknown[]) => mockRecordFailure(...a),
  cooldown: (...a: unknown[]) => mockCooldown(...a),
  rateLimitGuard: () => null,
}))

// DB mock — record inserts/updates/deletes through a tiny chainable builder.
const dbState: { inserted: unknown[]; updated: unknown[]; deletes: number } = {
  inserted: [],
  updated: [],
  deletes: 0,
}
vi.mock("@/lib/db", () => {
  const insert = () => ({
    values: async (vals: unknown) => {
      dbState.inserted.push(vals)
      return []
    },
  })
  const update = () => ({
    set: (vals: unknown) => ({
      where: async () => {
        dbState.updated.push(vals)
        return []
      },
    }),
  })
  const del = () => ({
    where: async () => {
      dbState.deletes++
      return []
    },
  })
  return { db: { insert, update, delete: del } }
})

vi.mock("@/lib/schema", () => ({
  usersTable: { id: "id", passwordHash: "password_hash" },
  emailVerificationTokensTable: { id: "id", userId: "user_id" },
  passwordResetTokensTable: { id: "id", userId: "user_id" },
}))

vi.mock("drizzle-orm", () => ({ eq: (...a: unknown[]) => ({ __eq: a }) }))

// --- Import the SUT after mocks --------------------------------------------

import { loginAction, requestPasswordReset, resetPassword } from "./auth"
import {
  ACCOUNT_LOCKED_MESSAGE,
  LOCKOUT_DURATION_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from "@/lib/auth-utils"

beforeEach(() => {
  vi.clearAllMocks()
  dbState.inserted = []
  dbState.updated = []
  dbState.deletes = 0
  mockCooldown.mockReturnValue({ ok: true })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("requestPasswordReset", () => {
  it("returns success and sends an email when a credentials user exists", async () => {
    mockGetUserByEmail.mockResolvedValue({ id: "user_1", passwordHash: "hash" })

    const res = await requestPasswordReset("Ada@Example.com")

    expect(res).toEqual({ success: true })
    // minted a token row + sent the reset email
    expect(dbState.inserted.length).toBe(1)
    expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(1)
    // normalizes the email (trim + lowercase) for both the send + cooldown key
    expect(mockSendPasswordResetEmail.mock.calls[0][0]).toBe("ada@example.com")
    // reset URL carries the token query param
    expect(mockSendPasswordResetEmail.mock.calls[0][1]).toContain("/reset-password?token=")
  })

  it("returns success but sends NOTHING for an unknown email (no enumeration)", async () => {
    mockGetUserByEmail.mockResolvedValue(null)

    const res = await requestPasswordReset("ghost@example.com")

    expect(res).toEqual({ success: true })
    expect(dbState.inserted.length).toBe(0)
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it("returns success but sends NOTHING for an OAuth-only user (no passwordHash)", async () => {
    mockGetUserByEmail.mockResolvedValue({ id: "user_2", passwordHash: null })

    const res = await requestPasswordReset("oauth@example.com")

    expect(res).toEqual({ success: true })
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it("respects the per-email cooldown without leaking via timing/db (still success)", async () => {
    mockCooldown.mockReturnValue({ ok: false, retryAfter: 42 })

    const res = await requestPasswordReset("ada@example.com")

    expect(res).toEqual({ success: true })
    expect(mockGetUserByEmail).not.toHaveBeenCalled()
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled()
  })
})

describe("resetPassword", () => {
  it("rejects a weak new password before any DB work", async () => {
    const res = await resetPassword("tok", "weak")
    expect(res.error).toBeTruthy()
    expect(mockGetPasswordResetToken).not.toHaveBeenCalled()
  })

  it("rejects an unknown token", async () => {
    mockGetPasswordResetToken.mockResolvedValue(null)
    const res = await resetPassword("nope", "Abcd1234")
    expect(res.error).toMatch(/無效|過期/)
    expect(mockHashPassword).not.toHaveBeenCalled()
  })

  it("rejects (and deletes) an expired token", async () => {
    mockGetPasswordResetToken.mockResolvedValue({
      id: "tk_1",
      userId: "user_1",
      expiresAt: new Date(Date.now() - 1000),
    })
    const res = await resetPassword("expired", "Abcd1234")
    expect(res.error).toMatch(/過期/)
    expect(mockHashPassword).not.toHaveBeenCalled()
    expect(dbState.deletes).toBe(1) // expired row cleaned up
  })

  it("hashes the new password, updates the user, and consumes the token on success", async () => {
    mockGetPasswordResetToken.mockResolvedValue({
      id: "tk_1",
      userId: "user_1",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    mockHashPassword.mockResolvedValue("new-hash")

    const res = await resetPassword("valid", "Abcd1234")

    expect(res).toEqual({ success: true })
    expect(mockHashPassword).toHaveBeenCalledWith("Abcd1234")
    expect(dbState.updated[0]).toMatchObject({ passwordHash: "new-hash" })
    expect(dbState.deletes).toBe(1) // token consumed
  })
})

// ---------------------------------------------------------------------------
// E355 — persistent login lockout, PATH 2: the 2FA branch of loginAction.
//
// This is the path a TOTP-enabled user's password takes. lib/auth.ts
// `authorize()` deliberately refuses raw credentials for those users (they
// finish via the nonce path), so their password is compared HERE and NOWHERE
// ELSE. Wiring the lockout only into authorize() would therefore leave every
// 2FA-enabled account brute-forceable with no persistent lock ever set — which
// is exactly the hole these tests exist to keep closed.
// ---------------------------------------------------------------------------

function loginForm(email = "ada@example.com", password = "Correct1234"): FormData {
  const fd = new FormData()
  fd.set("email", email)
  fd.set("password", password)
  return fd
}

const totpUser = (over: Record<string, unknown> = {}) => ({
  id: "user_2fa",
  email: "ada@example.com",
  passwordHash: "hash",
  emailVerified: new Date("2026-01-01T00:00:00.000Z"),
  totpEnabled: true,
  failedLoginCount: 0,
  lockedUntil: null,
  ...over,
})

describe("loginAction — 2FA branch lockout wiring (E355, path 2)", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("counts a wrong password for a TOTP user (nextFailedState wired + persisted)", async () => {
    mockGetUserByEmail.mockResolvedValue(totpUser({ failedLoginCount: 1 }))
    mockComparePassword.mockResolvedValue(false)

    const res = await loginAction(null, loginForm("ada@example.com", "wrong"))

    expect(res).toEqual({ error: "電子郵件或密碼錯誤。" })
    // the DB-backed counter advanced — NOT just the in-memory bucket
    expect(dbState.updated).toEqual([{ failedLoginCount: 2, lockedUntil: null }])
    // the pre-existing in-memory throttle still fires too (both layers)
    expect(mockRecordFailure).toHaveBeenCalledTimes(2) // email bucket + ip bucket
    expect(mockSetPending2fa).not.toHaveBeenCalled()
  })

  it("LOCKS a TOTP user on the 5th consecutive wrong password", async () => {
    mockGetUserByEmail.mockResolvedValue(
      totpUser({ failedLoginCount: MAX_FAILED_LOGIN_ATTEMPTS - 1 }),
    )
    mockComparePassword.mockResolvedValue(false)

    const before = Date.now()
    const res = await loginAction(null, loginForm("ada@example.com", "wrong"))
    const after = Date.now()

    expect(res).toEqual({ error: "電子郵件或密碼錯誤。" })
    const written = dbState.updated[0] as { failedLoginCount: number; lockedUntil: Date }
    expect(written.failedLoginCount).toBe(MAX_FAILED_LOGIN_ATTEMPTS)
    expect(written.lockedUntil).toBeInstanceOf(Date)
    expect(written.lockedUntil.getTime()).toBeGreaterThanOrEqual(before + LOCKOUT_DURATION_MS)
    expect(written.lockedUntil.getTime()).toBeLessThanOrEqual(after + LOCKOUT_DURATION_MS)
  })

  it("blocks a LOCKED TOTP user before bcrypt, with the friendly message", async () => {
    mockGetUserByEmail.mockResolvedValue(
      totpUser({
        failedLoginCount: MAX_FAILED_LOGIN_ATTEMPTS,
        lockedUntil: new Date(Date.now() + 60_000),
      }),
    )
    mockComparePassword.mockResolvedValue(true)

    const res = await loginAction(null, loginForm())

    expect(res).toEqual({ error: ACCOUNT_LOCKED_MESSAGE })
    expect(mockComparePassword).not.toHaveBeenCalled() // no expensive hash
    expect(dbState.updated).toHaveLength(0)
    expect(mockSetPending2fa).not.toHaveBeenCalled()
  })

  it("full sequence: 5 misses lock the TOTP account, the 6th try is refused", async () => {
    let row = totpUser()
    mockComparePassword.mockResolvedValue(false)

    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
      mockGetUserByEmail.mockResolvedValue(row)
      const res = await loginAction(null, loginForm("ada@example.com", "wrong"))
      expect(res).toEqual({ error: "電子郵件或密碼錯誤。" })
      row = totpUser(dbState.updated[dbState.updated.length - 1] as Record<string, unknown>)
    }
    expect(mockComparePassword).toHaveBeenCalledTimes(MAX_FAILED_LOGIN_ATTEMPTS)

    // 6th attempt — even with the CORRECT password.
    mockComparePassword.mockClear()
    mockComparePassword.mockResolvedValue(true)
    mockGetUserByEmail.mockResolvedValue(row)
    const res = await loginAction(null, loginForm())

    expect(res).toEqual({ error: ACCOUNT_LOCKED_MESSAGE })
    expect(mockComparePassword).not.toHaveBeenCalled()
  })

  it("clears the counter/lock when a TOTP user's password is CORRECT", async () => {
    mockGetUserByEmail.mockResolvedValue(totpUser({ failedLoginCount: 3 }))
    mockComparePassword.mockResolvedValue(true)

    await loginAction(null, loginForm())

    expect(dbState.updated).toEqual([{ failedLoginCount: 0, lockedUntil: null }])
    expect(mockSetPending2fa).toHaveBeenCalledWith("user_2fa")
    expect(mockRedirect).toHaveBeenCalledWith("/login/2fa")
  })

  it("does NOT write on a clean TOTP password check with no prior failures", async () => {
    mockGetUserByEmail.mockResolvedValue(totpUser())
    mockComparePassword.mockResolvedValue(true)

    await loginAction(null, loginForm())

    expect(dbState.updated).toHaveLength(0)
    expect(mockRedirect).toHaveBeenCalledWith("/login/2fa")
  })

  it("restarts the count for a TOTP user after an EXPIRED lock", async () => {
    mockGetUserByEmail.mockResolvedValue(
      totpUser({
        failedLoginCount: MAX_FAILED_LOGIN_ATTEMPTS,
        lockedUntil: new Date(Date.now() - 1000),
      }),
    )
    mockComparePassword.mockResolvedValue(false)

    await loginAction(null, loginForm("ada@example.com", "wrong"))

    expect(mockComparePassword).toHaveBeenCalledTimes(1) // expired ⇒ not blocked
    expect(dbState.updated).toEqual([{ failedLoginCount: 1, lockedUntil: null }])
  })

  it("ENABLE_LOGIN_LOCKOUT=false ⇒ 10 misses write NOTHING for a TOTP user", async () => {
    vi.stubEnv("ENABLE_LOGIN_LOCKOUT", "false")
    mockGetUserByEmail.mockResolvedValue(totpUser())
    mockComparePassword.mockResolvedValue(false)

    for (let i = 0; i < 10; i++) {
      const res = await loginAction(null, loginForm("ada@example.com", "wrong"))
      expect(res).toEqual({ error: "電子郵件或密碼錯誤。" })
    }

    expect(mockComparePassword).toHaveBeenCalledTimes(10)
    expect(dbState.updated).toHaveLength(0)
  })

  it("ENABLE_LOGIN_LOCKOUT=false ⇒ an existing lock stops blocking (escape hatch)", async () => {
    vi.stubEnv("ENABLE_LOGIN_LOCKOUT", "false")
    mockGetUserByEmail.mockResolvedValue(
      totpUser({
        failedLoginCount: MAX_FAILED_LOGIN_ATTEMPTS,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      }),
    )
    mockComparePassword.mockResolvedValue(true)

    await loginAction(null, loginForm())

    expect(mockRedirect).toHaveBeenCalledWith("/login/2fa") // got through
    expect(dbState.updated).toHaveLength(0) // columns kept, not cleared
  })
})

describe("loginAction — lockout pre-check for NON-2FA users (path 1 UX)", () => {
  const plainUser = (over: Record<string, unknown> = {}) => ({
    id: "user_1",
    email: "ada@example.com",
    passwordHash: "hash",
    emailVerified: new Date("2026-01-01T00:00:00.000Z"),
    totpEnabled: false,
    failedLoginCount: 0,
    lockedUntil: null,
    ...over,
  })

  it("returns the friendly locked message instead of calling signIn", async () => {
    mockGetUserByEmail.mockResolvedValue(
      plainUser({
        failedLoginCount: MAX_FAILED_LOGIN_ATTEMPTS,
        lockedUntil: new Date(Date.now() + 60_000),
      }),
    )

    const res = await loginAction(null, loginForm())

    expect(res).toEqual({ error: ACCOUNT_LOCKED_MESSAGE })
    expect(mockSignIn).not.toHaveBeenCalled()
  })

  it("falls through to signIn when the account is not locked", async () => {
    mockGetUserByEmail.mockResolvedValue(plainUser())

    await loginAction(null, loginForm())

    expect(mockSignIn).toHaveBeenCalledTimes(1)
  })
})
