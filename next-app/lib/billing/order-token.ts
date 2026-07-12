/**
 * Order access token — E327.
 *
 * The thank-you page (`app/p/[slug]/thanks`) must let a GUEST (no session) view
 * their own order status without exposing every order to anyone who can guess a
 * UUID. We derive a short, deterministic HMAC token from the order id + the
 * order's own email, keyed by AUTH_SECRET. The token is handed to the buyer in
 * the checkout redirect URL; the thanks page recomputes it from the stored order
 * and compares (timing-safe). No token is persisted — it is a pure function of
 * (orderId, email, AUTH_SECRET).
 */

import crypto from "crypto"

/** Length of the hex token slice (128 bits of the SHA-256 HMAC). */
const TOKEN_LEN = 32

function secret(): string {
  // Fall back to a dev constant so local runs without AUTH_SECRET still work;
  // production always sets AUTH_SECRET (JWT sessions require it).
  return process.env.AUTH_SECRET ?? "dev-order-token-secret"
}

/**
 * Derive the access token for an order. Deterministic for a given
 * (orderId, email, AUTH_SECRET) triple; email is lower-cased so casing in the
 * checkout form never changes the token.
 */
export function orderAccessToken(orderId: string, email: string): string {
  return crypto
    .createHmac("sha256", secret())
    .update(`${orderId}:${email.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, TOKEN_LEN)
}

/**
 * Timing-safe verification of a presented token against the expected one for
 * (orderId, email). Returns false on any length/format mismatch.
 */
export function verifyOrderAccessToken(
  orderId: string,
  email: string,
  presented: string,
): boolean {
  if (!presented) return false
  const expected = orderAccessToken(orderId, email)
  const a = Buffer.from(presented)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
