import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { LoginForm } from "./_login-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "登入",
  description: "登入您的帳戶",
}

type Props = {
  searchParams: Promise<{ verified?: string; error?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const session = await auth()
  if (session) redirect("/dashboard")

  const { verified, error } = await searchParams

  return <LoginForm verified={verified === "true"} urlError={error} />
}
