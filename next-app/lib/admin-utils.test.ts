import { describe, expect, it } from "vitest"

import {
  assertAdminRole,
  assertNotSelf,
  assertNotSelfDelete,
  isValidRole,
} from "./admin-utils"

describe("isValidRole", () => {
  it("accepts the three valid roles", () => {
    expect(isValidRole("admin")).toBe(true)
    expect(isValidRole("editor")).toBe(true)
    expect(isValidRole("viewer")).toBe(true)
  })

  it("rejects unknown strings", () => {
    expect(isValidRole("superadmin")).toBe(false)
    expect(isValidRole("")).toBe(false)
    expect(isValidRole("root")).toBe(false)
  })

  it("rejects non-string values", () => {
    expect(isValidRole(undefined)).toBe(false)
    expect(isValidRole(null)).toBe(false)
    expect(isValidRole(42)).toBe(false)
  })
})

describe("assertNotSelf (role change guard)", () => {
  it("returns null when actor and target are different users", () => {
    expect(assertNotSelf("actor-1", "target-2")).toBeNull()
  })

  it("returns an error string when actor targets themselves", () => {
    const err = assertNotSelf("user-abc", "user-abc")
    expect(err).toMatch(/自己的角色/)
  })
})

describe("assertNotSelfDelete (delete guard)", () => {
  it("returns null when actor and target are different users", () => {
    expect(assertNotSelfDelete("actor-1", "target-2")).toBeNull()
  })

  it("returns an error string when actor tries to delete themselves", () => {
    const err = assertNotSelfDelete("user-xyz", "user-xyz")
    expect(err).toMatch(/自己的帳戶/)
  })
})

describe("assertAdminRole", () => {
  it("returns null for the admin role", () => {
    expect(assertAdminRole("admin")).toBeNull()
  })

  it("returns an error string for non-admin roles", () => {
    expect(assertAdminRole("editor")).toMatch(/管理員/)
    expect(assertAdminRole("viewer")).toMatch(/管理員/)
  })

  it("returns an error string for undefined role (unauthenticated)", () => {
    expect(assertAdminRole(undefined)).toMatch(/管理員/)
  })

  it("returns an error string for unexpected role strings", () => {
    expect(assertAdminRole("superadmin")).toMatch(/管理員/)
  })
})

// E310 — the admin-assisted 2FA reset (actions/admin.ts resetUserTotp) is gated
// by requireAdmin, whose role check is this same pure guard. Documenting the
// contract: only the admin role may reset another user's 2FA.
describe("assertAdminRole — 2FA reset gate (E310)", () => {
  it("permits an admin to reset 2FA", () => {
    expect(assertAdminRole("admin")).toBeNull()
  })

  it("blocks editors and viewers from resetting 2FA", () => {
    expect(assertAdminRole("editor")).toMatch(/管理員/)
    expect(assertAdminRole("viewer")).toMatch(/管理員/)
  })

  it("blocks an unauthenticated caller from resetting 2FA", () => {
    expect(assertAdminRole(undefined)).toMatch(/管理員/)
  })
})
