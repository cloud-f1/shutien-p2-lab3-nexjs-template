"use server"

import { signIn, signOut } from "@/lib/auth"
import { db } from "@/lib/db"
import { emailVerificationTokensTable, usersTable } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { getUserByEmail, getVerificationToken } from "@/lib/queries"
import { hashPassword } from "@/lib/password"
import { sendVerificationEmail } from "@/lib/email"
import type { FormState } from "@/lib/validations/types"
import { unstable_rethrow } from "next/navigation"
import { redirect } from "next/navigation"
import crypto from "crypto"
import { registerSchema, loginSchema } from "@/lib/validations/auth"

// ─── OAuth ───────────────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" })
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

  const existing = await getUserByEmail(email)
  if (existing) {
    return { error: "此電子郵件已被註冊。" }
  }

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

  // Pre-check: unverified credentials users get a helpful error before Auth.js runs
  const user = await getUserByEmail(email)
  if (user?.passwordHash && !user.emailVerified) {
    return { error: "請先驗證您的電子郵件再登入，請檢查您的收件匣。" }
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" })
  } catch (error) {
    unstable_rethrow(error) // re-throw redirect() so the redirect actually fires
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
