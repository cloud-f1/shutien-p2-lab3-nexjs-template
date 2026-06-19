"use server"

import { db } from "@/lib/db"
import { usersTable } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/permissions"
import { unstable_update } from "@/lib/auth"
import { comparePassword, hashPassword } from "@/lib/password"
import { updateProfileSchema, changePasswordSchema } from "@/lib/validations/user"
import type { FormState } from "@/lib/validations/types"
import { assertHasPassword, assertCurrentPasswordValid } from "@/lib/user-utils"
import { rateLimitGuard } from "@/lib/rate-limit"
import {
  generateSecret,
  generateQrDataUri,
  verifyToken,
  generateBackupCodes,
  hashBackupCode,
  assertValidTotpForAction,
} from "@/lib/totp-utils"

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS

export async function updateProfile(prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAuth()

  // Lenient: 10 profile saves / minute per user.
  const limited = rateLimitGuard(`user:profile:${session.user.id}`, 10, MINUTE_MS)
  if (limited) return limited

  const result = updateProfileSchema.safeParse({
    name: formData.get("name"),
    image: formData.get("image") || "",
  })
  if (!result.success) return { error: result.error.errors[0].message }

  const { name, image } = result.data
  const nextImage = image || null
  await db
    .update(usersTable)
    .set({ name, image: nextImage, updatedAt: new Date() })
    .where(eq(usersTable.id, session.user.id))

  // Push the new name/image into the JWT (trigger==='update' in lib/auth.ts jwt
  // callback) so the sidebar/settings reflect the change without a re-login.
  await unstable_update({ user: { name, image: nextImage } })

  revalidatePath("/dashboard/settings")
  return { success: true }
}

export async function changePassword(prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAuth()

  // Anti-brute-force on the post-auth change: 3 attempts / hour per user.
  const limited = rateLimitGuard(`user:password:${session.user.id}`, 3, HOUR_MS)
  if (limited) return limited

  const result = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  })
  if (!result.success) return { error: result.error.errors[0].message }

  const { currentPassword, newPassword } = result.data

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.user.id))
  const oauthErr = assertHasPassword(user?.passwordHash)
  if (oauthErr) return { error: oauthErr }

  const isValid = await comparePassword(currentPassword, user!.passwordHash!)
  const pwErr = assertCurrentPasswordValid(isValid)
  if (pwErr) return { error: pwErr }

  const newHash = await hashPassword(newPassword)
  await db
    .update(usersTable)
    .set({ passwordHash: newHash, updatedAt: new Date() })
    .where(eq(usersTable.id, session.user.id))

  revalidatePath("/dashboard/settings")
  return { success: true }
}

// ─── TOTP Two-Factor Authentication (E297) ──────────────────────────────────

export type SetupTotpResult =
  | { secret: string; qrDataUri: string; error?: never }
  | { error: string; secret?: never; qrDataUri?: never }

/**
 * Begin TOTP enrollment: generate a fresh secret, persist it on the user row
 * (with totpEnabled still false), and return the secret + a QR data URI for the
 * setup modal. The secret only becomes authoritative once verifyTotpSetup
 * confirms the user can produce a valid code.
 */
export async function setupTotp(): Promise<SetupTotpResult> {
  const session = await requireAuth()

  const limited = rateLimitGuard(`user:2fa-setup:${session.user.id}`, 5, HOUR_MS)
  if (limited) return { error: limited.error }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.user.id))
  if (!user) return { error: "找不到使用者。" }
  if (user.totpEnabled) return { error: "兩步驟驗證已啟用。" }

  const secret = generateSecret()
  await db
    .update(usersTable)
    .set({ totpSecret: secret, updatedAt: new Date() })
    .where(eq(usersTable.id, session.user.id))

  const qrDataUri = await generateQrDataUri(secret, user.email)
  return { secret, qrDataUri }
}

export type VerifyTotpSetupResult =
  | { success: true; backupCodes: string[]; error?: never }
  | { success?: false; error: string; backupCodes?: never }

/**
 * Finish TOTP enrollment: verify the first code against the pending secret, flip
 * totpEnabled on, generate + store hashed one-time backup codes, and return the
 * PLAINTEXT codes once (shown to the user, never stored in the clear).
 */
export async function verifyTotpSetup(
  prevState: VerifyTotpSetupResult | null,
  formData: FormData,
): Promise<VerifyTotpSetupResult> {
  const session = await requireAuth()

  const limited = rateLimitGuard(`user:2fa-verify:${session.user.id}`, 10, HOUR_MS)
  if (limited) return { error: limited.error }

  const token = String(formData.get("token") ?? "")
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.user.id))
  if (!user?.totpSecret) return { error: "請先重新開始設定流程。" }
  if (user.totpEnabled) return { error: "兩步驟驗證已啟用。" }

  if (!verifyToken(user.totpSecret, token)) {
    return { error: "驗證碼錯誤，請再試一次。" }
  }

  const plainCodes = generateBackupCodes(10)
  const hashed = await Promise.all(plainCodes.map(hashBackupCode))
  await db
    .update(usersTable)
    .set({ totpEnabled: true, backupCodes: hashed, updatedAt: new Date() })
    .where(eq(usersTable.id, session.user.id))

  revalidatePath("/dashboard/settings")
  return { success: true, backupCodes: plainCodes }
}

/**
 * Disable 2FA. Requires a valid current TOTP code (anti-CSRF / proves the
 * authenticator is still in the user's possession) before clearing the secret,
 * the enabled flag, and any remaining backup codes.
 */
export async function disableTotp(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireAuth()

  const limited = rateLimitGuard(`user:2fa-disable:${session.user.id}`, 5, HOUR_MS)
  if (limited) return limited

  const token = String(formData.get("token") ?? "")
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.user.id))
  if (!user?.totpEnabled || !user.totpSecret) {
    return { error: "兩步驟驗證尚未啟用。" }
  }

  if (!verifyToken(user.totpSecret, token)) {
    return { error: "驗證碼錯誤，請再試一次。" }
  }

  await db
    .update(usersTable)
    .set({ totpSecret: null, totpEnabled: false, backupCodes: null, updatedAt: new Date() })
    .where(eq(usersTable.id, session.user.id))

  revalidatePath("/dashboard/settings")
  return { success: true }
}

export type RegenerateBackupCodesResult =
  | { success: true; backupCodes: string[]; error?: never }
  | { success?: false; error: string; backupCodes?: never }

/**
 * E310 — Regenerate one-time backup codes. Requires a valid current TOTP code
 * (proves the authenticator is still in the user's possession) before replacing
 * the stored hashes. Returns the fresh PLAINTEXT codes once; the previous codes
 * are invalidated. Lets a user low on / out of codes refresh them without an
 * admin reset.
 */
export async function regenerateBackupCodes(
  prevState: RegenerateBackupCodesResult | null,
  formData: FormData,
): Promise<RegenerateBackupCodesResult> {
  const session = await requireAuth()

  const limited = rateLimitGuard(`user:2fa-regen:${session.user.id}`, 5, HOUR_MS)
  if (limited) return { error: limited.error }

  const token = String(formData.get("token") ?? "")
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.user.id))

  const guardErr = assertValidTotpForAction(user, token)
  if (guardErr) return { error: guardErr }

  const plainCodes = generateBackupCodes(10)
  const hashed = await Promise.all(plainCodes.map(hashBackupCode))
  await db
    .update(usersTable)
    .set({ backupCodes: hashed, updatedAt: new Date() })
    .where(eq(usersTable.id, session.user.id))

  revalidatePath("/dashboard/settings")
  return { success: true, backupCodes: plainCodes }
}

// ─── Onboarding persistence (E310) ──────────────────────────────────────────

/**
 * Persist onboarding completion server-side (DB is the source of truth; the
 * useOnboarding hook treats localStorage as an optimistic layer only). Idempotent
 * — re-calling keeps the first completion timestamp.
 */
export async function completeOnboarding(): Promise<{ success: true } | { error: string }> {
  const session = await requireAuth()

  const [user] = await db
    .select({ onboardingCompletedAt: usersTable.onboardingCompletedAt })
    .from(usersTable)
    .where(eq(usersTable.id, session.user.id))

  if (user && !user.onboardingCompletedAt) {
    await db
      .update(usersTable)
      .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
      .where(eq(usersTable.id, session.user.id))
  }

  revalidatePath("/dashboard")
  return { success: true }
}

/** Persist onboarding dismissal server-side so the card stays hidden across devices. */
export async function dismissOnboarding(): Promise<{ success: true } | { error: string }> {
  const session = await requireAuth()

  await db
    .update(usersTable)
    .set({ onboardingDismissed: true, updatedAt: new Date() })
    .where(eq(usersTable.id, session.user.id))

  revalidatePath("/dashboard")
  return { success: true }
}
