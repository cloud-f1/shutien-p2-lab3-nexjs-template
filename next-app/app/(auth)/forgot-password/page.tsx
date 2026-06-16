import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ForgotPasswordForm } from "./_forgot-password-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "忘記密碼",
  description: "重設您的帳戶密碼",
}

export default async function ForgotPasswordPage() {
  const session = await auth()
  if (session) redirect("/dashboard")

  return <ForgotPasswordForm />
}
