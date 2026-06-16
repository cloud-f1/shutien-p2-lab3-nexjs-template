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
vi.mock("@/lib/auth", () => ({ signIn: vi.fn(), signOut: vi.fn() }))
vi.mock("next/headers", () => ({ headers: async () => new Map() }))
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  unstable_rethrow: vi.fn(),
}))

const mockGetUserByEmail = vi.fn()
const mockGetPasswordResetToken = vi.fn()
vi.mock("@/lib/queries", () => ({
  getUserByEmail: (...a: unknown[]) => mockGetUserByEmail(...a),
  getVerificationToken: vi.fn(),
  getPasswordResetToken: (...a: unknown[]) => mockGetPasswordResetToken(...a),
}))

const mockSendVerificationEmail = vi.fn()
const mockSendPasswordResetEmail = vi.fn()
vi.mock("@/lib/email", () => ({
  sendVerificationEmail: (...a: unknown[]) => mockSendVerificationEmail(...a),
  sendPasswordResetEmail: (...a: unknown[]) => mockSendPasswordResetEmail(...a),
}))

const mockHashPassword = vi.fn()
vi.mock("@/lib/password", () => ({
  hashPassword: (...a: unknown[]) => mockHashPassword(...a),
}))

// Rate-limit: default to "allowed". cooldown() controls the request flow.
const mockCooldown = vi.fn()
vi.mock("@/lib/rate-limit", () => ({
  isRateLimited: () => ({ ok: true }),
  recordFailure: vi.fn(),
  cooldown: (...a: unknown[]) => mockCooldown(...a),
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

import { requestPasswordReset, resetPassword } from "./auth"

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
