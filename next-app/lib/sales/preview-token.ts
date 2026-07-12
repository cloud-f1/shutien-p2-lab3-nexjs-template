/**
 * Draft-preview token — E332.
 *
 * A DB-backed sales page in `draft` status is invisible to the public. An admin
 * can generate a short-lived signed token so a `draft` page is viewable at
 * `/p/[slug]?preview=<token>` before it is published. The token is a pure
 * function of (slug, expiry, AUTH_SECRET) — nothing is persisted:
 *
 *   token = `${expiryMs}.${HMAC_SHA256(slug:expiryMs)[:32]}`
 *
 * Verification recomputes the HMAC (timing-safe) AND checks the embedded expiry,
 * so a token that is tampered with, minted for another slug, or past its TTL all
 * fail. Keyed by AUTH_SECRET (falls back to a dev constant for local runs).
 */

import crypto from "crypto"

/** Length of the hex signature slice (128 bits of the SHA-256 HMAC). */
const SIG_LEN = 32

/** Default token lifetime: 1 hour. */
export const DEFAULT_PREVIEW_TTL_MS = 60 * 60 * 1000

function secret(): string {
  // Local runs without AUTH_SECRET still work; production always sets it.
  return process.env.AUTH_SECRET ?? "dev-sales-preview-secret"
}

function sign(slug: string, expiryMs: number): string {
  return crypto
    .createHmac("sha256", secret())
    .update(`${slug}:${expiryMs}`)
    .digest("hex")
    .slice(0, SIG_LEN)
}

/**
 * Mint a preview token for `slug`, valid for `ttlMs` from `now`. `now` is
 * injectable for deterministic tests.
 */
export function createPreviewToken(
  slug: string,
  ttlMs: number = DEFAULT_PREVIEW_TTL_MS,
  now: number = Date.now(),
): string {
  const expiryMs = now + ttlMs
  return `${expiryMs}.${sign(slug, expiryMs)}`
}

/**
 * Verify a presented preview token for `slug`. Returns false on any
 * format/signature mismatch or when the embedded expiry is at/before `now`.
 */
export function verifyPreviewToken(
  slug: string,
  presented: string | undefined | null,
  now: number = Date.now(),
): boolean {
  if (!presented) return false
  const dot = presented.indexOf(".")
  if (dot <= 0) return false

  const expiryPart = presented.slice(0, dot)
  const sigPart = presented.slice(dot + 1)

  // Expiry must be a positive integer and still in the future.
  const expiryMs = Number(expiryPart)
  if (!Number.isInteger(expiryMs) || expiryMs <= now) return false

  const expected = sign(slug, expiryMs)
  const a = Buffer.from(sigPart)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
