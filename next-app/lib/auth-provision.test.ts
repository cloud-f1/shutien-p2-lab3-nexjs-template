/**
 * E328 — provisionUserForOrder() unit tests (db + queries mocked; real crypto).
 *
 * Locks the security-critical guarantees:
 *   • a NEW email creates a user with `passwordHash: null` (NO usable password)
 *     and issues an activation token — a plaintext/random password is NEVER
 *     generated or written;
 *   • an EXISTING email links only (no new account, no token);
 *   • `isNewUser` is reported correctly.
 */
import { afterEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  existingUser: null as { id: string } | null,
  insertedUserValues: null as Record<string, unknown> | null,
  insertedTokenValues: null as Record<string, unknown> | null,
}))

vi.mock("@/lib/queries", () => ({
  getUserByEmail: async () => state.existingUser,
}))

vi.mock("@/lib/db", () => {
  const db = {
    insert(table: { __t: string }) {
      return {
        values: (v: Record<string, unknown>) => {
          if (table.__t === "users") {
            state.insertedUserValues = v
            return { returning: async () => [{ id: "new-user-1" }] }
          }
          state.insertedTokenValues = v
          return Promise.resolve(undefined)
        },
      }
    },
  }
  return { db }
})

vi.mock("@/lib/schema", () => ({
  usersTable: { __t: "users" },
  passwordResetTokensTable: { __t: "password_reset_tokens" },
}))

import { provisionUserForOrder } from "./auth-provision"

afterEach(() => {
  state.existingUser = null
  state.insertedUserValues = null
  state.insertedTokenValues = null
  vi.clearAllMocks()
})

describe("provisionUserForOrder", () => {
  it("creates a NO-password account + activation token for a new email", async () => {
    state.existingUser = null

    const result = await provisionUserForOrder("Buyer@Example.com", "Buyer")

    expect(result.isNewUser).toBe(true)
    expect(result.userId).toBe("new-user-1")
    expect(result.activationToken).toMatch(/^[a-f0-9]{64}$/) // real hex reset token

    // NO usable password was written…
    expect(state.insertedUserValues?.passwordHash).toBeNull()
    // …and definitely no plaintext/random password field anywhere in the insert.
    const serialized = JSON.stringify(state.insertedUserValues)
    expect(serialized).not.toMatch(/password(?!Hash)/i)
    expect(serialized).not.toContain('"password"')
    // Email normalized to lower-case.
    expect(state.insertedUserValues?.email).toBe("buyer@example.com")

    // The activation token is the row we persisted (reuses E290 reset tokens).
    expect(state.insertedTokenValues?.token).toBe(result.activationToken)
  })

  it("links an EXISTING email only — no new account, no token", async () => {
    state.existingUser = { id: "existing-1" }

    const result = await provisionUserForOrder("known@example.com")

    expect(result).toEqual({
      userId: "existing-1",
      isNewUser: false,
      activationToken: null,
    })
    // Nothing was inserted.
    expect(state.insertedUserValues).toBeNull()
    expect(state.insertedTokenValues).toBeNull()
  })
})
