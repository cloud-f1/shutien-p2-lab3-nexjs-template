import { describe, expect, it } from "vitest"
import { generateSync } from "otplib"

import {
  generateSecret,
  generateUri,
  generateQrDataUri,
  verifyToken,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
  normalizeBackupCode,
  generateNonce,
  assertValidTotpForAction,
} from "./totp-utils"

const PERIOD = 30
const now = Date.UTC(2026, 5, 18, 12, 0, 0) // fixed clock for determinism

function tokenAt(secret: string, atMs: number): string {
  return generateSync({ secret, strategy: "totp", period: PERIOD, epoch: atMs })
}

describe("totp-utils", () => {
  describe("generateSecret", () => {
    it("produces a non-empty base32 secret, unique per call", () => {
      const a = generateSecret()
      const b = generateSecret()
      expect(a).toMatch(/^[A-Z2-7]+$/) // base32 alphabet
      expect(a.length).toBeGreaterThanOrEqual(16)
      expect(a).not.toBe(b)
    })
  })

  describe("generateUri", () => {
    it("builds an otpauth:// URI carrying the secret + issuer + label", () => {
      const secret = generateSecret()
      const uri = generateUri(secret, "user@example.com")
      expect(uri.startsWith("otpauth://totp/")).toBe(true)
      expect(uri).toContain(`secret=${secret}`)
      expect(uri).toContain("issuer=")
      expect(decodeURIComponent(uri)).toContain("user@example.com")
    })
  })

  describe("generateQrDataUri", () => {
    it("returns a PNG data URI", async () => {
      const secret = generateSecret()
      const dataUri = await generateQrDataUri(secret, "user@example.com")
      expect(dataUri.startsWith("data:image/png;base64,")).toBe(true)
      expect(dataUri.length).toBeGreaterThan(100)
    })
  })

  describe("verifyToken", () => {
    it("accepts a freshly generated token (gen → verify cycle)", () => {
      const secret = generateSecret()
      const token = tokenAt(secret, now)
      expect(verifyToken(secret, token, now)).toBe(true)
    })

    it("tolerates ±1 step (clock skew)", () => {
      const secret = generateSecret()
      const prev = tokenAt(secret, now - PERIOD * 1000)
      const next = tokenAt(secret, now + PERIOD * 1000)
      expect(verifyToken(secret, prev, now)).toBe(true)
      expect(verifyToken(secret, next, now)).toBe(true)
    })

    it("rejects a token two steps away", () => {
      const secret = generateSecret()
      const far = tokenAt(secret, now + 2 * PERIOD * 1000)
      expect(verifyToken(secret, far, now)).toBe(false)
    })

    it("rejects a token from a different secret", () => {
      const token = tokenAt(generateSecret(), now)
      expect(verifyToken(generateSecret(), token, now)).toBe(false)
    })

    it("strips internal whitespace before checking", () => {
      const secret = generateSecret()
      const token = tokenAt(secret, now)
      const spaced = `${token.slice(0, 3)} ${token.slice(3)}`
      expect(verifyToken(secret, spaced, now)).toBe(true)
    })

    it("rejects malformed (non-6-digit) input", () => {
      const secret = generateSecret()
      expect(verifyToken(secret, "12345", now)).toBe(false)
      expect(verifyToken(secret, "abcdef", now)).toBe(false)
      expect(verifyToken(secret, "", now)).toBe(false)
    })
  })

  describe("generateBackupCodes", () => {
    it("generates 10 unique formatted codes by default", () => {
      const codes = generateBackupCodes()
      expect(codes).toHaveLength(10)
      expect(new Set(codes).size).toBe(10)
      for (const c of codes) expect(c).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}$/)
    })

    it("honours a custom count", () => {
      expect(generateBackupCodes(3)).toHaveLength(3)
    })
  })

  describe("hashBackupCode / verifyBackupCode", () => {
    it("round-trips: a code verifies against its own hash", async () => {
      const [code] = generateBackupCodes(1)
      const hash = await hashBackupCode(code)
      expect(hash).not.toBe(code)
      expect(await verifyBackupCode(hash, code)).toBe(true)
    })

    it("rejects a wrong code", async () => {
      const hash = await hashBackupCode("aaaa-bbbb")
      expect(await verifyBackupCode(hash, "cccc-dddd")).toBe(false)
    })

    it("is case- and whitespace-insensitive on the submitted code", async () => {
      const hash = await hashBackupCode("aaaa-bbbb")
      expect(await verifyBackupCode(hash, "  AAAA-BBBB ")).toBe(true)
    })
  })

  describe("normalizeBackupCode", () => {
    it("lowercases + strips surrounding/internal whitespace", () => {
      expect(normalizeBackupCode("  AB CD-EF GH ")).toBe("abcd-efgh")
    })
  })

  describe("generateNonce", () => {
    it("produces a 32-char hex nonce, unique per call", () => {
      const a = generateNonce()
      const b = generateNonce()
      expect(a).toMatch(/^[a-f0-9]{32}$/)
      expect(a).not.toBe(b)
    })
  })

  // E310 — guard used by regenerateBackupCodes (and shareable by any action that
  // must prove the authenticator is still in the user's possession).
  describe("assertValidTotpForAction", () => {
    it("returns null when 2FA is enabled and a valid current code is supplied", () => {
      const secret = generateSecret()
      const token = tokenAt(secret, now)
      const user = { totpEnabled: true, totpSecret: secret }
      expect(assertValidTotpForAction(user, token, now)).toBeNull()
    })

    it("rejects when 2FA is not enabled", () => {
      const secret = generateSecret()
      const token = tokenAt(secret, now)
      expect(
        assertValidTotpForAction({ totpEnabled: false, totpSecret: secret }, token, now),
      ).toMatch(/尚未啟用/)
    })

    it("rejects when the secret is missing", () => {
      expect(
        assertValidTotpForAction({ totpEnabled: true, totpSecret: null }, "000000", now),
      ).toMatch(/尚未啟用/)
    })

    it("rejects a null/undefined user", () => {
      expect(assertValidTotpForAction(null, "000000", now)).toMatch(/尚未啟用/)
      expect(assertValidTotpForAction(undefined, "000000", now)).toMatch(/尚未啟用/)
    })

    it("rejects a wrong code on an enabled account", () => {
      const secret = generateSecret()
      const wrong = tokenAt(secret, now + 2 * PERIOD * 1000) // two steps away
      expect(
        assertValidTotpForAction({ totpEnabled: true, totpSecret: secret }, wrong, now),
      ).toMatch(/驗證碼錯誤/)
    })

    it("rejects malformed input on an enabled account", () => {
      const secret = generateSecret()
      expect(
        assertValidTotpForAction({ totpEnabled: true, totpSecret: secret }, "12345", now),
      ).toMatch(/驗證碼錯誤/)
    })
  })
})
