// Pure webhook signing/format helpers — NO db import (unit-testable in isolation).
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

/** Mint a new HMAC signing secret: `whsec_<random>`. */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`
}

/**
 * Sign a raw JSON body with HMAC-SHA256. Returns the header value
 * `t=<unixSeconds>,v1=<hexdigest>` (Stripe-style). The timestamp is signed
 * alongside the body so a captured signature can't be replayed indefinitely.
 */
export function signWebhook(payload: string, secret: string, timestampSeconds: number): string {
  const digest = createHmac("sha256", secret).update(`${timestampSeconds}.${payload}`).digest("hex")
  return `t=${timestampSeconds},v1=${digest}`
}

/** Parse a `t=…,v1=…` signature header into its parts, or null if malformed. */
export function parseSignatureHeader(header: string | null | undefined): { t: number; v1: string } | null {
  if (!header) return null
  let t: number | null = null
  let v1: string | null = null
  for (const part of header.split(",")) {
    const [k, v] = part.split("=")
    if (k === "t") t = Number(v)
    else if (k === "v1") v1 = v
  }
  if (t === null || Number.isNaN(t) || !v1) return null
  return { t, v1 }
}

/**
 * Verify a signature header against the raw body. Constant-time compare.
 * When `toleranceSeconds` is set, rejects timestamps outside the window
 * (replay protection); pass `now` to keep this function pure/testable.
 */
export function verifyWebhook(
  payload: string,
  secret: string,
  header: string | null | undefined,
  opts: { toleranceSeconds?: number; now?: number } = {},
): boolean {
  const parsed = parseSignatureHeader(header)
  if (!parsed) return false
  if (opts.toleranceSeconds != null && opts.now != null) {
    if (Math.abs(opts.now - parsed.t) > opts.toleranceSeconds) return false
  }
  const expected = createHmac("sha256", secret).update(`${parsed.t}.${payload}`).digest("hex")
  const a = Buffer.from(expected, "hex")
  const b = Buffer.from(parsed.v1, "hex")
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Exponential backoff (ms) for delivery retry attempt N (1-indexed): 1s, 4s, 9s… capped. */
export function backoffMs(attempt: number, capMs = 60_000): number {
  return Math.min(attempt * attempt * 1000, capMs)
}
