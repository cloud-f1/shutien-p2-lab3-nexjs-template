/**
 * E297 — Pure, db-free TOTP + backup-code helpers.
 *
 * No `@/lib/db` import here so the module stays unit-testable without a DATABASE_URL
 * (the Server Actions in actions/{user,auth}.ts wrap these with persistence). Uses
 * otplib (functional API, v13) for the RFC-6238 maths, qrcode for the setup data
 * URI, and bcryptjs to hash the one-time backup codes.
 */
import { randomBytes, randomInt } from "crypto"
import bcrypt from "bcryptjs"
import { generateSecret as otpGenerateSecret, generateSync, generateURI } from "otplib"
import QRCode from "qrcode"

const ISSUER = "AI Coding Template"
const PERIOD = 30 // seconds per TOTP step (RFC-6238 default)
const STRATEGY = "totp" as const

/** Generate a fresh base32 TOTP shared secret. */
export function generateSecret(): string {
  return otpGenerateSecret()
}

/** Build the `otpauth://` provisioning URI an authenticator app scans. */
export function generateUri(secret: string, accountName: string): string {
  return generateURI({
    strategy: STRATEGY,
    issuer: ISSUER,
    label: accountName,
    secret,
    period: PERIOD,
  })
}

/**
 * Render the provisioning URI as a PNG data URI (`data:image/png;base64,...`) so
 * the setup modal can show it in an `<img>` without an extra route.
 */
export async function generateQrDataUri(secret: string, accountName: string): Promise<string> {
  const uri = generateUri(secret, accountName)
  return QRCode.toDataURL(uri)
}

/**
 * Verify a 6-digit token against the secret, accepting the current step plus one
 * step either side (±30s) to tolerate clock skew. We compute the expected token
 * at each offset rather than relying on otplib's tolerance options (their
 * behaviour differs across v13 builds), keeping this deterministic + testable.
 */
export function verifyToken(secret: string, token: string, atMs: number = Date.now()): boolean {
  const cleaned = token.replace(/\s/g, "")
  if (!/^\d{6}$/.test(cleaned)) return false
  for (const offset of [0, -PERIOD * 1000, PERIOD * 1000]) {
    const expected = generateSync({ secret, strategy: STRATEGY, period: PERIOD, epoch: atMs + offset })
    if (expected === cleaned) return true
  }
  return false
}

/**
 * Generate `n` human-friendly one-time backup codes (e.g. "a1b2-c3d4"). Returns
 * the PLAINTEXT codes — the caller shows them once and persists only the hashes.
 */
export function generateBackupCodes(n = 10): string[] {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
  const codes: string[] = []
  for (let i = 0; i < n; i++) {
    let raw = ""
    for (let j = 0; j < 8; j++) raw += alphabet[randomInt(alphabet.length)]
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`)
  }
  return codes
}

/** Hash a single backup code for storage (bcrypt; codes are compared on use). */
export function hashBackupCode(code: string): Promise<string> {
  return bcrypt.hash(normalizeBackupCode(code), 10)
}

/** Constant-time compare of a submitted backup code against a stored hash. */
export function verifyBackupCode(hash: string, code: string): Promise<boolean> {
  return bcrypt.compare(normalizeBackupCode(code), hash)
}

/** Normalise user-entered backup codes (case + stray whitespace) before hashing. */
export function normalizeBackupCode(code: string): string {
  return code.trim().toLowerCase().replace(/\s+/g, "")
}

/**
 * Short, signed, single-use marker the credentials provider accepts in lieu of a
 * password once the 2FA challenge passes (see lib/pending-2fa.ts). Exposed here so
 * the random portion has one source of truth.
 */
export function generateNonce(): string {
  return randomBytes(16).toString("hex")
}
