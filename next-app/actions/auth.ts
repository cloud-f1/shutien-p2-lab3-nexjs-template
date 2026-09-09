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
import { logAudit } from "@/lib/audit"
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

  // E371 — one exception, and it is NOT an enumeration leak.
  //
  // E327 guest checkout provisions a SHELL account for the purchase email
  // (lib/auth-provision.ts): no password hash, and since E371 no emailVerified
  // either. Because `customerEmail` is unproven, anyone could buy the cheapest
  // product as victim@example.com and permanently burn that address for
  // self-registration — the victim's later registerUser took the "already
  // exists → skip" branch and sat on /verify-email forever, with no mail and no
  // error.
  //
  // A shell has NO credentials, so completing its registration cannot take over
  // anything. And it stays non-enumerating because the OUTSIDE behaviour is
  // identical in all three cases (new / shell / real account): same redirect,
  // and a mail is sent in exactly the cases where one would have been anyway.
  const isUnclaimedShell =
    existing != null && existing.passwordHash == null && existing.emailVerified == null

  if (!existing || isUnclaimedShell) {
    const passwordHash = await hashPassword(password)
    let userId: string

    if (isUnclaimedShell) {
      await db
        .update(usersTable)
        .set({ name, passwordHash, updatedAt: new Date() })
        .where(eq(usersTable.id, existing!.id))
      userId = existing!.id
    } else {
      const [user] = await db
        .insert(usersTable)
        .values({ name, email, passwordHash })
        .returning({ id: usersTable.id })
      userId = user.id
    }

    const token = crypto.randomBytes(32).toString("hex")
    await db.insert(emailVerificationTokensTable).values({
      userId,
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
  //
  // E356 — the same login-audit policy as lib/auth.ts applies here: `user` is
  // null for an unknown email and isLocked(null) is false, so a nonexistent
  // account can never reach an audit write on this path either.
  // (`user &&` is a type-narrowing no-op — isLocked(null/undefined) is already
  // false — that lets the audit call below see a non-null row without a `!`.)
  if (user && isLocked(user, new Date())) {
    // This early return means the request never reaches signIn()/authorize(),
    // so THIS is the only place the event can be recorded for a locked user
    // arriving through the login form — no double-write is possible.
    await logAudit({
      actorId: user.id,
      action: "auth.locked",
      targetType: "user",
      targetId: user.id,
      metadata: { method: "password" },
    })
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
      let trippedLock = false
      if (isLockoutEnabled()) {
        const next = nextFailedState(user, new Date())
        trippedLock = next.lockedUntil !== null
        await db
          .update(usersTable)
          .set({ failedLoginCount: next.failedLoginCount, lockedUntil: next.lockedUntil })
          .where(eq(usersTable.id, user.id))
      }
      // E356 — a TOTP user's password is compared HERE and nowhere else, so this
      // is the only place their `auth.login_failed` can be recorded (authorize()
      // never sees it). Same shape as path 1, including the lock transition.
      await logAudit({
        actorId: user.id,
        action: "auth.login_failed",
        targetType: "user",
        targetId: user.id,
        metadata: { method: "password" },
      })
      if (trippedLock) {
        await logAudit({
          actorId: user.id,
          action: "auth.locked",
          targetType: "user",
          targetId: user.id,
          metadata: { method: "password" },
        })
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
    //
    // E356 — deliberately NO audit write here: this branch is the non-2FA path,
    // whose password comparison happened inside authorizeCredentials(), which
    // already emitted the right event (auth.login_failed / auth.locked, or
    // nothing at all for an unknown email). Logging again would double-count
    // every failure and would also break the no-write-for-unknown-email policy.
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

  // E371 (F8) — non-enumerating on EVERY branch. The line below used to be
  // `return { error: "此電子郵件已驗證。" }`, which separated "registered and
  // verified" from everything else for an attacker walking a list of addresses
  // — directly contradicting the comment sitting above it. requestPasswordReset
  // (further down this file) is the shape being matched: always `{ success: true }`,
  // do the real work only when it applies. The 60s per-email cooldown above
  // still limits mail-bombing.
  if (!user?.passwordHash) return { success: true }
  if (user.emailVerified) return { success: true }

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

  // E371 — this UPDATE now carries two things it was missing.
  //
  // F2: clearedLoginState(). The E355 lockout columns were cleared in exactly
  // two places, BOTH of which require a successful password comparison. A user
  // locked out by 5 bad attempts who does the natural remedy — 忘記密碼 → reset
  // — got a new hash but kept `lockedUntil` in the future, so loginAction still
  // refused the CORRECT new password. (The lock is 15 minutes, not permanent,
  // so this was a confusing window rather than a dead account — which is also
  // why no admin-unlock action is needed.)
  //
  // F5: emailVerified. Redeeming this token proves control of the mailbox it
  // was sent to. That matters most for the E327 guest-checkout activation link,
  // which mints exactly this kind of token — see lib/auth-provision.ts, where
  // the stamp used to be applied at row-creation time for an address nobody had
  // proven. Stamped only when absent, so an existing verification date is kept.
  const existingVerified = await db
    .select({ emailVerified: usersTable.emailVerified })
    .from(usersTable)
    .where(eq(usersTable.id, record.userId))
    .limit(1)
    .then((r) => r[0]?.emailVerified ?? null)

  await db
    .update(usersTable)
    .set({
      passwordHash,
      updatedAt: new Date(),
      emailVerified: existingVerified ?? new Date(),
      ...clearedLoginState(),
    })
    .where(eq(usersTable.id, record.userId))

  await db
    .delete(passwordResetTokensTable)
    .where(eq(passwordResetTokensTable.id, record.id))

  return { success: true }
}


/**
 * E371 (F10) — record a failed SECOND-FACTOR attempt against the same persistent
 * lockout columns the password factor uses (E355).
 *
 * Before this, `verifyTotpLogin` / `useBackupCode` were guarded only by
 * `rateLimitGuard`, whose backing store is the in-process Map in
 * lib/rate-limit.ts — its own header states the state "is lost on restart and is
 * NOT shared across serverless instances or horizontally-scaled replicas". That
 * is precisely the weakness E355 introduced DB columns to close, and only the
 * first factor got them.
 *
 * Why the in-memory limiter was not enough on its own: an attacker who already
 * has the password can call `loginAction` again — a CORRECT password resets
 * `failedLoginCount` — to mint a fresh pending-2FA cookie, and keep guessing the
 * second factor across process recycles and replicas with nothing ever
 * persisted.
 *
 * Honours ENABLE_LOGIN_LOCKOUT exactly like the password path: flag off ⇒ no DB
 * write at all (E355's "complete no-op" contract).
 *
 * Returns true when THIS failure tripped the lock, so the caller can say so.
 */
async function recordSecondFactorFailure(userId: string): Promise<boolean> {
  if (!isLockoutEnabled()) return false
  const user = await getUserById(userId)
  if (!user) return false
  const next = nextFailedState(user, new Date())
  await db
    .update(usersTable)
    .set({ failedLoginCount: next.failedLoginCount, lockedUntil: next.lockedUntil })
    .where(eq(usersTable.id, userId))
  if (next.lockedUntil) {
    await logAudit({
      actorId: userId,
      action: "auth.locked",
      targetType: "user",
      targetId: userId,
      metadata: { method: "totp" },
    })
  }
  return next.lockedUntil !== null
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

  // E371 — a persistently locked account cannot complete the second factor
  // either. Checked BEFORE the TOTP maths so a locked attacker burns no CPU,
  // matching the ordering invariant E355 established in lib/auth.ts.
  if (isLocked(user, new Date())) {
    return { error: "此帳號因多次登入失敗已暫時鎖定，請稍後再試。" }
  }

  if (!verifyToken(user.totpSecret, token)) {
    const tripped = await recordSecondFactorFailure(userId)
    return {
      error: tripped
        ? "驗證碼錯誤次數過多，此帳號已暫時鎖定，請稍後再試。"
        : "驗證碼錯誤，請再試一次。",
    }
  }

  // E371 — a correct second factor clears accumulated failures, mirroring what
  // a correct password does in loginAction. Without this, three bad codes
  // followed by a good one leaves the counter at 3, and the NEXT login's two
  // slips would lock an account that has done nothing wrong.
  if (isLockoutEnabled() && hasLoginFailuresToClear(user)) {
    await db.update(usersTable).set(clearedLoginState()).where(eq(usersTable.id, userId))
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

  // E371 — same persistent-lockout gate as verifyTotpLogin. Checked before the
  // bcrypt loop below, which is the expensive part (one compare per stored code).
  if (isLocked(user, new Date())) {
    return { error: "此帳號因多次登入失敗已暫時鎖定，請稍後再試。" }
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
    const tripped = await recordSecondFactorFailure(userId)
    return {
      error: tripped
        ? "備用碼錯誤次數過多，此帳號已暫時鎖定，請稍後再試。"
        : "備用碼無效或已使用。",
    }
  }

  // Consume the code (single-use): remove its hash from the array. E371 folds
  // the failure-counter reset into the same UPDATE — see verifyTotpLogin.
  const remaining = user.backupCodes.filter((_, i) => i !== matchIndex)
  await db
    .update(usersTable)
    .set({
      backupCodes: remaining,
      updatedAt: new Date(),
      ...(isLockoutEnabled() && hasLoginFailuresToClear(user) ? clearedLoginState() : {}),
    })
    .where(eq(usersTable.id, userId))

  // E371 — a correct second factor clears accumulated failures, mirroring what
  // a correct password does in loginAction. Without this, three bad codes
  // followed by a good one leaves the counter at 3, and the NEXT login's two
  // slips would lock an account that has done nothing wrong.
  if (isLockoutEnabled() && hasLoginFailuresToClear(user)) {
    await db.update(usersTable).set(clearedLoginState()).where(eq(usersTable.id, userId))
  }

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
