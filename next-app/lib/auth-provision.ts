/**
 * Auto-provision on purchase — E328. When a paid order's `customer_email` has no
 * matching account, create one so the buyer owns a real member identity they can
 * later sign into — WITHOUT ever generating, storing, or emailing a plaintext /
 * random password. The account is created with `password_hash = NULL` (no usable
 * password) and the buyer sets their own via an activation link that reuses the
 * E290 `password_reset_tokens` infrastructure.
 *
 * `email_verified` is stamped at provision time: receiving the activation email
 * proves ownership of the address, and the credentials login gate
 * (actions/auth.ts) refuses an unverified credentials user — so without this the
 * newly-provisioned buyer could never log in after setting a password.
 *
 * If the email already belongs to a user, we link only (no new account, no token).
 */

import { db } from "@/lib/db"
import { passwordResetTokensTable, usersTable } from "@/lib/schema"
import { getUserByEmail } from "@/lib/queries"
import { generateResetToken, resetExpiry } from "@/lib/password-reset-utils"

export interface ProvisionResult {
  /** The user the order should be linked to (existing or freshly created). */
  userId: string
  /** True only when THIS call created a new account. */
  isNewUser: boolean
  /**
   * The single-use activation (set-password) token for a newly created account,
   * or `null` for an existing user. Reuses the E290 password-reset token infra.
   */
  activationToken: string | null
}

/**
 * Find-or-create the account for a purchase email. New accounts get NO usable
 * password (hash stays null) plus a fresh activation token; existing accounts are
 * returned as-is for linking. Never mints or persists a plaintext password.
 */
export async function provisionUserForOrder(
  email: string,
  name?: string | null,
): Promise<ProvisionResult> {
  const normalized = email.trim().toLowerCase()

  const existing = await getUserByEmail(normalized)
  if (existing) {
    return { userId: existing.id, isNewUser: false, activationToken: null }
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      email: normalized,
      name: name ?? null,
      // NO usable password — the buyer sets one via the activation link.
      passwordHash: null,
      // Purchase-email ownership is proven by receiving the activation mail.
      emailVerified: new Date(),
    })
    .returning({ id: usersTable.id })

  const token = generateResetToken()
  await db.insert(passwordResetTokensTable).values({
    userId: user.id,
    token,
    expiresAt: resetExpiry(new Date()),
  })

  return { userId: user.id, isNewUser: true, activationToken: token }
}
