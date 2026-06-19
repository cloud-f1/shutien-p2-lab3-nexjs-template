import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { readPending2fa } from "@/lib/pending-2fa"

import { TwoFactorForm } from "./_two-factor-form"

export const metadata: Metadata = {
  title: "兩步驟驗證",
  description: "輸入您的驗證碼",
}

export default async function TwoFactorPage() {
  // Already signed in → straight to the dashboard.
  const session = await auth()
  if (session) redirect("/dashboard")

  // The pending-2FA cookie proves the password already passed (set by
  // loginAction). Without it there is nothing to challenge — back to /login.
  const userId = await readPending2fa()
  if (!userId) redirect("/login")

  return <TwoFactorForm />
}
