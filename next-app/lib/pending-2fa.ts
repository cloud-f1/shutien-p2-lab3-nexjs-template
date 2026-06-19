/**
 * E297 — the bridge between "credentials passed" and "session completed" for
 * 2FA-enabled users.
 *
 * Auth.js v5's Credentials `signIn` completes the session immediately, so we
 * cannot gate inside `authorize`. Instead, `loginAction` verifies the password
 * itself and — when the user has TOTP enabled — sets a short-lived, HMAC-signed
 * cookie instead of signing in. The /login/2fa page + verify actions read that
 * cookie, check the TOTP/backup code, then mint a single-use **nonce** and call
 * `signIn("credentials", { totpNonce })`; `authorize` accepts that nonce in place
 * of a password (the password was already verified) and completes the session.
 *
 * Node-only (crypto + a server-side nonce store). Never imported into the Edge
 * proxy or a client bundle.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"

const COOKIE = "pending_2fa"
const TTL_MS = 5 * 60 * 1000 // a login challenge is valid for 5 minutes

// Single-use nonce store: userId-scoped tokens minted after a 2FA code passes,
// consumed (deleted) when authorize() completes the session. In-memory — same
// caveats as lib/rate-limit.ts (fine for a single-process starter template; back
// with Redis when scaling horizontally).
const nonces = new Map<string, { userId: string; expiresAt: number }>()

function secret(): string {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error("AUTH_SECRET is required to sign the 2FA challenge cookie")
  return s
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex")
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/** Set the signed "awaiting 2FA" cookie for `userId` (httpOnly, 5-min TTL). */
export async function setPending2fa(userId: string): Promise<void> {
  const expiresAt = Date.now() + TTL_MS
  const payload = `${userId}.${expiresAt}`
  const value = `${payload}.${sign(payload)}`
  const jar = await cookies()
  jar.set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  })
}

/** Read + verify the pending-2FA cookie; returns the userId or null. */
export async function readPending2fa(): Promise<string | null> {
  const jar = await cookies()
  const raw = jar.get(COOKIE)?.value
  if (!raw) return null
  const parts = raw.split(".")
  if (parts.length !== 3) return null
  const [userId, expiresAtStr, mac] = parts
  if (!safeEqual(mac, sign(`${userId}.${expiresAtStr}`))) return null
  const expiresAt = Number(expiresAtStr)
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null
  return userId
}

/** Clear the pending-2FA cookie (after success or abandonment). */
export async function clearPending2fa(): Promise<void> {
  const jar = await cookies()
  jar.delete(COOKIE)
}

/** Mint a single-use nonce that authorize() will exchange for a session. */
export function issueNonce(userId: string): string {
  // Keyed by an opaque random token; value carries the userId so authorize()
  // can look up who it belongs to.
  const token = randomBytes(24).toString("hex")
  nonces.set(token, { userId, expiresAt: Date.now() + 60_000 })
  return token
}

/**
 * Consume a nonce: returns the bound userId once (then deletes it), or null if
 * unknown/expired. Called from authorize() to complete the 2FA login.
 */
export function consumeNonce(token: string): string | null {
  const entry = nonces.get(token)
  if (!entry) return null
  nonces.delete(token)
  if (Date.now() > entry.expiresAt) return null
  return entry.userId
}

/** Test helper — clears the nonce store. */
export function __resetNonces() {
  nonces.clear()
}
