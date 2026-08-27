"use server"
// stop-verifier:public-action — every export in this file IS a pre-auth entry
// point by design: OAuth kickoff, register, login, email verification,
// password reset, and the 2FA challenge/backup-code steps all run BEFORE a
// session exists, so none of them can call requireAuth()/requireAdmin(). Each
// one still validates its own input server-side (Zod schemas), rate-limits,
// and never reveals account existence (E346/E350 — the same audit round that
// added this marker's enforcement rule, see docs/epics/e351-use-server-guard-rule.md).

import { signIn, signOut } from "@/lib/auth"
import { db } from "@/lib/db"
import { emailVerificationTokensTable, passwordResetTokensTable, usersTable } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { getUserByEmail, getVerificationToken, getPasswordResetToken, getUserById } from "@/lib/queries"
import { comparePassword, hashPassword } from "@/lib/password"
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/email"
import type { FormState } from "@/lib/validations/types"
import { unstable_rethrow } from "next/navigation"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import crypto from "crypto"
import { registerSchema, loginSchema, resetPasswordSchema } from "@/lib/validations/auth"
import {
  generateResetToken,
  resetExpiry,
  isResetTokenValid,
} from "@/lib/password-reset-utils"
import { isRateLimited, recordFailure, cooldown, rateLimitGuard } from "@/lib/rate-limit"
import {
  ACCOUNT_LOCKED_MESSAGE,
  clearedLoginState,
  hasLoginFailuresToClear,
  isLocked,
  isLockoutEnabled,
  nextFailedState,
} from "@/lib/auth-utils"
import { verifyToken, verifyBackupCode } from "@/lib/totp-utils"
import {
  setPending2fa,
  readPending2fa,
  clearPending2fa,
  issueNonce,
} from "@/lib/pending-2fa"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

// Best-effort client IP from common proxy headers (Zeabur / Vercel / nginx).
async function getClientIp(): Promise<string> {
  const h = await headers()
  const forwarded = h.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return h.get("x-real-ip") ?? "unknown"
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" })
}

export async function signInWithGitHub() {
  await signIn("github", { redirectTo: "/dashboard" })
}

export async function handleSignOut() {
  await signOut({ redirectTo: "/login" })
}

// ─── Registration ─────────────────────────────────────────────────────────────

export async function registerUser(prevState: FormState, formData: FormData): Promise<FormState> {
  const result = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  const { name, email, password } = result.data

  // Non-enumerating: never reveal whether the email already exists. If it does,
  // silently skip the insert and still route to the verification page with a
  // generic success path — an attacker cannot distinguish "taken" from "new".
  const existing = await getUserByEmail(email)
  if (!existing) {
    const passwordHash = await hashPassword(password)
    const [user] = await db
      .insert(usersTable)
      .values({ name, email, passwordHash })
      .returning({ id: usersTable.id })

    const token = crypto.randomBytes(32).toString("hex")
    await db.insert(emailVerificationTokensTable).values({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })

    await sendVerificationEmail(email, token)
  }

  redirect(`/verify-email?email=${encodeURIComponent(email)}`)
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function loginAction(prevState: FormState, formData: FormData): Promise<FormState> {
  // Re-validate server-side with the SAME schema the client uses (defence in depth).
  const result = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  const { email, password } = result.data

  // Rate limit before doing any (expensive) bcrypt work. We only count *failed*
  // attempts (recordFailure below) so a legitimate login never burns the budget:
  // 5 failures per email and 10 per IP within a 15-minute window blunts brute-force.
  const WINDOW_MS = 15 * 60 * 1000
  const emailKey = `login:email:${email.toLowerCase()}`
  const ip = await getClientIp()
  const ipKey = `login:ip:${ip}`
  if (!isRateLimited(emailKey, 5).ok || !isRateLimited(ipKey, 10).ok) {
    return { error: "嘗試次數過多，請稍後再試。" }
  }

  // Pre-check: unverified credentials users get a helpful error before Auth.js runs
  const user = await getUserByEmail(email)
  if (user?.passwordHash && !user.emailVerified) {
    return { error: "請先驗證您的電子郵件再登入，請檢查您的收件匣。" }
  }

  // E355 — persistent lockout pre-check. Covers BOTH password paths: the 2FA
  // branch just below and the signIn()/authorize() path further down (which
  // enforces the same gate itself — this is only the friendly message, and it
  // also spares us the bcrypt round-trip). isLocked() returns false whenever
  // ENABLE_LOGIN_LOCKOUT is off, which is the deliberate escape hatch.
  if (isLocked(user, new Date())) {
    return { error: ACCOUNT_LOCKED_MESSAGE }
  }

  // 2FA gate (E297): a TOTP-enabled user must clear the /login/2fa challenge
  // before a session is created. authorize() refuses the raw-credentials path
  // for these users, so we verify the password HERE, stash a signed
  // pending-2FA cookie, and route to the challenge instead of signing in.
  //
  // E355 — this is the SECOND password-verification path in the template, and
  // it must carry its own lockout wiring: authorize() never sees a TOTP user's
  // password, so counting only there would leave every 2FA-enabled account
  // brute-forceable with no persistent lock ever being set.
  if (user?.passwordHash && user.emailVerified && user.totpEnabled) {
    const ok = await comparePassword(password, user.passwordHash)
    if (!ok) {
      recordFailure(emailKey, WINDOW_MS)
      recordFailure(ipKey, WINDOW_MS)
      // Flag off ⇒ complete no-op: no counting, no lock, no DB write.
      if (isLockoutEnabled()) {
        const next = nextFailedState(user, new Date())
        await db
          .update(usersTable)
          .set({ failedLoginCount: next.failedLoginCount, lockedUntil: next.lockedUntil })
          .where(eq(usersTable.id, user.id))
      }
      return { error: "電子郵件或密碼錯誤。" }
    }
    // Correct password clears any accumulated failures / lock (skip the UPDATE
    // when there is nothing to clear).
    if (isLockoutEnabled() && hasLoginFailuresToClear(user)) {
      await db.update(usersTable).set(clearedLoginState()).where(eq(usersTable.id, user.id))
    }
    await setPending2fa(user.id)
    redirect("/login/2fa")
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" })
  } catch (error) {
    unstable_rethrow(error) // re-throw redirect() so the redirect actually fires
    // Only reached on a genuine auth failure (the success path threw a redirect
    // and was re-thrown above) — count it against both buckets.
    recordFailure(emailKey, WINDOW_MS)
    recordFailure(ipKey, WINDOW_MS)
    return { error: "電子郵件或密碼錯誤。" }
  }

  return null
}

// ─── Email Verification ───────────────────────────────────────────────────────

export async function verifyEmailToken(
  token: string,
): Promise<{ success: boolean; error?: string }> {
  const record = await getVerificationToken(token)

  if (!record) {
    return { success: false, error: "驗證連結無效或已過期。" }
  }

  if (record.expiresAt < new Date()) {
    await db
      .delete(emailVerificationTokensTable)
      .where(eq(emailVerificationTokensTable.id, record.id))
    return { success: false, error: "此連結已過期，請重新註冊。" }
  }

  await db
    .update(usersTable)
    .set({ emailVerified: new Date() })
    .where(eq(usersTable.id, record.userId))

  await db
    .delete(emailVerificationTokensTable)
    .where(eq(emailVerificationTokensTable.id, record.id))

  return { success: true }
}

export async function resendVerificationEmail(
  email: string,
): Promise<{ error?: string; success?: boolean }> {
  // Per-email cooldown (60s) to prevent email-bombing. Checked before the DB
  // lookup and before revealing anything about the account.
  const cool = cooldown(`resend:${email.toLowerCase()}`, 60 * 1000)
  if (!cool.ok) {
    return { error: `請稍候 ${cool.retryAfter} 秒後再重新寄送。` }
  }

  const user = await getUserByEmail(email)

  // Don't reveal whether the email exists
  if (!user?.passwordHash) return { success: true }
  if (user.emailVerified) return { error: "此電子郵件已驗證。" }

  await db
    .delete(emailVerificationTokensTable)
    .where(eq(emailVerificationTokensTable.userId, user.id))

  const token = crypto.randomBytes(32).toString("hex")
  await db.insert(emailVerificationTokensTable).values({
    userId: user.id,
    token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })

  await sendVerificationEmail(email, token)
  return { success: true }
}

// ─── Password Reset ─────────────────────────────────────────────────────────

/**
 * Request a password-reset link. ALWAYS returns success to avoid user
 * enumeration — the caller cannot tell whether the email is registered. A token
 * + email are only created/sent when a credentials user actually exists.
 */
export async function requestPasswordReset(
  email: string,
): Promise<{ success: true }> {
  const normalized = email.trim().toLowerCase()

  // Per-email cooldown (60s) so the endpoint can't be used to email-bomb a
  // known address. Checked before the DB lookup; we still return success.
  const cool = cooldown(`reset:${normalized}`, 60 * 1000)
  if (!cool.ok) return { success: true }

  const user = await getUserByEmail(normalized)

  // Only credentials users (have a passwordHash) can reset a password.
  if (user?.passwordHash) {
    // Invalidate any outstanding reset tokens for this user before minting a new one.
    await db
      .delete(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.userId, user.id))

    const token = generateResetToken()
    await db.insert(passwordResetTokensTable).values({
      userId: user.id,
      token,
      expiresAt: resetExpiry(new Date()),
    })

    const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`
    await sendPasswordResetEmail(normalized, resetUrl)
  }

  return { success: true }
}

/**
 * Complete a password reset. Verifies the token is present + unexpired, bcrypts
 * the new password, updates the user's hash, and consumes (deletes) the token.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ success?: boolean; error?: string }> {
  const result = resetPasswordSchema.safeParse({ token, password: newPassword })
  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  const record = await getPasswordResetToken(token)
  if (!record) {
    return { error: "重設連結無效或已過期。" }
  }

  if (!isResetTokenValid(record, new Date())) {
    await db
      .delete(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.id, record.id))
    return { error: "此連結已過期，請重新申請。" }
  }

  const passwordHash = await hashPassword(result.data.password)
  await db
    .update(usersTable)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(usersTable.id, record.userId))

  await db
    .delete(passwordResetTokensTable)
    .where(eq(passwordResetTokensTable.id, record.id))

  return { success: true }
}

// ─── Two-Factor Login Challenge (E297) ─────────────────────────────────────

/**
 * Complete a 2FA login with a 6-digit TOTP code. Requires the signed
 * pending-2FA cookie set by loginAction (proves the password already passed).
 * On success, mints a single-use nonce and signs in via the nonce path in
 * lib/auth.ts authorize() — which redirects to /dashboard.
 */
export async function verifyTotpLogin(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await readPending2fa()
  if (!userId) return { error: "驗證階段已逾時，請重新登入。" }

  // Blunt brute-force on the challenge: 5 attempts / 15 min per pending user.
  const limited = rateLimitGuard(`2fa:login:${userId}`, 5, 15 * 60 * 1000)
  if (limited) return limited

  const token = String(formData.get("token") ?? "")
  const user = await getUserById(userId)
  if (!user || !user.totpEnabled || !user.totpSecret) {
    return { error: "驗證階段無效，請重新登入。" }
  }

  if (!verifyToken(user.totpSecret, token)) {
    return { error: "驗證碼錯誤，請再試一次。" }
  }

  const nonce = issueNonce(userId)
  await clearPending2fa()
  try {
    await signIn("credentials", { totpNonce: nonce, redirectTo: "/dashboard" })
  } catch (error) {
    unstable_rethrow(error) // re-throw the success redirect
    return { error: "登入失敗，請重新登入。" }
  }
  return null
}

/**
 * Complete a 2FA login with a one-time backup code. Verifies the code against
 * the stored hashes, removes the consumed hash, then completes the session.
 */
export async function useBackupCode(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await readPending2fa()
  if (!userId) return { error: "驗證階段已逾時，請重新登入。" }

  const limited = rateLimitGuard(`2fa:backup:${userId}`, 5, 15 * 60 * 1000)
  if (limited) return limited

  const code = String(formData.get("code") ?? "")
  const user = await getUserById(userId)
  if (!user || !user.totpEnabled || !user.backupCodes?.length) {
    return { error: "驗證階段無效，請重新登入。" }
  }

  // Find the matching hash (bcrypt — must compare each).
  let matchIndex = -1
  for (let i = 0; i < user.backupCodes.length; i++) {
    if (await verifyBackupCode(user.backupCodes[i], code)) {
      matchIndex = i
      break
    }
  }
  if (matchIndex === -1) {
    return { error: "備用碼無效或已使用。" }
  }

  // Consume the code (single-use): remove its hash from the array.
  const remaining = user.backupCodes.filter((_, i) => i !== matchIndex)
  await db
    .update(usersTable)
    .set({ backupCodes: remaining, updatedAt: new Date() })
    .where(eq(usersTable.id, userId))

  const nonce = issueNonce(userId)
  await clearPending2fa()
  try {
    await signIn("credentials", { totpNonce: nonce, redirectTo: "/dashboard" })
  } catch (error) {
    unstable_rethrow(error)
    return { error: "登入失敗，請重新登入。" }
  }
  return null
}
