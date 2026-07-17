/**
 * Day-scoped anonymous session hash — E334.
 *
 * The funnel needs to count UNIQUE sessions (so a visitor refreshing five times
 * is one "瀏覽", and rates are meaningful) WITHOUT storing anything that
 * identifies a person. This derives a one-way HMAC over (calendar-day + client
 * fingerprint parts) keyed by AUTH_SECRET:
 *
 *   - It rotates every UTC day, so it cannot be used to track a person across
 *     days (day-scoped by construction).
 *   - It is NOT reversible and the raw IP / User-Agent are NEVER stored — only
 *     this opaque digest lands in `sales_page_events.session_hash`.
 *   - It is deterministic within a day, so `count(distinct session_hash)` gives a
 *     unique-session count for aggregation.
 *
 * Pure + db-free → unit-tested and in vitest's coverage include.
 */

import crypto from "crypto"

function secret(): string {
  // Same fallback posture as lib/billing/order-token.ts — local dev runs without
  // AUTH_SECRET still work; production always sets it (JWT sessions require it).
  return process.env.AUTH_SECRET ?? "dev-funnel-session-secret"
}

/** UTC calendar day (YYYY-MM-DD) — the rotation boundary. */
export function utcDayStamp(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export interface SessionHashParts {
  /** Best-effort client IP (from x-forwarded-for). Never stored raw. */
  ip: string | null
  /** Client User-Agent. Never stored raw. */
  userAgent: string | null
  /** Override the day stamp (tests); defaults to today (UTC). */
  day?: string
}

/**
 * Derive the day-scoped anonymous session hash. Two visits from the same client
 * on the same UTC day produce the same hash; a different day (or client) does
 * not. Returns a 32-char hex slice (128 bits — ample for distinct-counting).
 */
export function dayScopedSessionHash(parts: SessionHashParts): string {
  const day = parts.day ?? utcDayStamp()
  const material = `${day}|${parts.ip ?? "-"}|${parts.userAgent ?? "-"}`
  return crypto.createHmac("sha256", secret()).update(material).digest("hex").slice(0, 32)
}
