import { describe, expect, it } from "vitest"

import { generateResetToken, resetExpiry, isResetTokenValid } from "./password-reset-utils"

describe("password-reset-utils", () => {
  describe("generateResetToken", () => {
    it("produces a long, URL-safe, unique token", () => {
      const a = generateResetToken()
      const b = generateResetToken()
      expect(a).toMatch(/^[a-f0-9]+$/)
      expect(a.length).toBe(64) // 32 bytes hex-encoded
      expect(a).not.toBe(b)
    })
  })

  describe("resetExpiry / isResetTokenValid", () => {
    const now = new Date("2026-06-16T00:00:00Z")

    it("sets expiry 1 hour out", () => {
      const exp = resetExpiry(now)
      expect(exp.getTime() - now.getTime()).toBe(60 * 60 * 1000)
    })

    it("accepts an unexpired token", () => {
      expect(isResetTokenValid({ expiresAt: resetExpiry(now) }, now)).toBe(true)
    })

    it("rejects an expired token", () => {
      const past = new Date(now.getTime() - 1000)
      expect(isResetTokenValid({ expiresAt: past }, now)).toBe(false)
    })

    it("rejects a token expiring exactly at now (boundary)", () => {
      expect(isResetTokenValid({ expiresAt: now }, now)).toBe(false)
    })
  })
})
