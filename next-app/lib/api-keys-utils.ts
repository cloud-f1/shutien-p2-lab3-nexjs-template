// Pure API-key crypto/format helpers — NO db import (unit-testable in isolation).
import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

const PREFIX_LEN = 8

/**
 * Mint a new key: `sk_<prefix>_<secret>`. Store only `prefix` + `hashKey(secret)`.
 *
 * The prefix is hex (no `_`/`-`) so the `_` delimiter is unambiguous — the
 * base64url secret DOES contain `_`/`-`, and a delimiter-bearing prefix would
 * make `parseApiKey` split in the wrong place (intermittent verify failures).
 */
export function generateApiKey(): { plaintext: string; prefix: string; hashedKey: string } {
  const prefix = randomBytes(PREFIX_LEN).toString("hex").slice(0, PREFIX_LEN)
  const secret = randomBytes(24).toString("base64url")
  return { plaintext: `sk_${prefix}_${secret}`, prefix, hashedKey: hashKey(secret) }
}

/** SHA-256 of the secret portion (hex). */
export function hashKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex")
}

/** Parse a bearer/key string → { prefix, secret } or null if malformed. */
export function parseApiKey(raw: string | null | undefined): { prefix: string; secret: string } | null {
  if (!raw) return null
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw
  // Prefix is hex (delimiter-free); the secret may contain `_`/`-`, so only the
  // first `_` after the prefix is the real separator. Anchoring the prefix to a
  // delimiter-free alphabet keeps the split unambiguous.
  const m = /^sk_([A-Za-z0-9]{1,32})_([A-Za-z0-9_-]+)$/.exec(token.trim())
  return m ? { prefix: m[1], secret: m[2] } : null
}

/** Constant-time hex-hash compare. */
export function hashEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex")
  const bb = Buffer.from(b, "hex")
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}
