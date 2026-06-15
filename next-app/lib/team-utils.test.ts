import { describe, expect, it } from "vitest"

import {
  CAPABILITIES,
  PERMISSION_MATRIX,
  can,
  generateInviteToken,
  inviteExpiry,
  isInviteValid,
} from "./team-utils"

describe("team-utils", () => {
  describe("generateInviteToken", () => {
    it("produces a long, URL-safe, unique token", () => {
      const a = generateInviteToken()
      const b = generateInviteToken()
      expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(a.length).toBeGreaterThan(32)
      expect(a).not.toBe(b)
    })
  })

  describe("inviteExpiry / isInviteValid", () => {
    const now = new Date("2026-06-15T00:00:00Z")

    it("sets expiry 7 days out", () => {
      const exp = inviteExpiry(now)
      expect(exp.getTime() - now.getTime()).toBe(7 * 24 * 60 * 60 * 1000)
    })

    it("accepts a pending, unexpired invite", () => {
      expect(isInviteValid({ status: "pending", expiresAt: inviteExpiry(now) }, now)).toBe(true)
    })

    it("rejects expired or non-pending invites", () => {
      const past = new Date(now.getTime() - 1000)
      expect(isInviteValid({ status: "pending", expiresAt: past }, now)).toBe(false)
      expect(isInviteValid({ status: "accepted", expiresAt: inviteExpiry(now) }, now)).toBe(false)
      expect(isInviteValid({ status: "revoked", expiresAt: inviteExpiry(now) }, now)).toBe(false)
    })
  })

  describe("permission matrix", () => {
    it("defines every capability for every role", () => {
      for (const role of ["admin", "editor", "viewer"] as const) {
        for (const cap of CAPABILITIES) {
          expect(typeof PERMISSION_MATRIX[role][cap.key]).toBe("boolean")
        }
      }
    })

    it("grants admin everything, viewer read-only", () => {
      expect(can("admin", "members.manage")).toBe(true)
      expect(can("admin", "billing.manage")).toBe(true)
      expect(can("editor", "items.write")).toBe(true)
      expect(can("editor", "members.manage")).toBe(false)
      expect(can("viewer", "items.read")).toBe(true)
      expect(can("viewer", "items.write")).toBe(false)
    })

    it("returns false for unknown roles", () => {
      expect(can(undefined, "items.read")).toBe(false)
      expect(can("ghost", "items.read")).toBe(false)
    })
  })
})
