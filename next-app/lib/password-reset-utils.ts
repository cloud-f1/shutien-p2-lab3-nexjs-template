// Pure password-reset token/expiry helpers — NO db import (unit-testable in
// isolation), mirroring lib/team-utils.ts.
import { randomBytes } from "node:crypto"

// Short-lived: password reset links expire after 1 hour.
const RESET_TTL_MS = 60 * 60 * 1000

/** Opaque, URL-safe password-reset token. */
export function generateResetToken(): string {
  return randomBytes(32).toString("hex")
}

/** Expiry timestamp for a freshly-minted reset token, given "now". */
export function resetExpiry(now: Date): Date {
  return new Date(now.getTime() + RESET_TTL_MS)
}

/** A reset token is acceptable only while unexpired. */
export function isResetTokenValid(
  record: { expiresAt: Date },
  now: Date,
): boolean {
  return record.expiresAt.getTime() > now.getTime()
}
