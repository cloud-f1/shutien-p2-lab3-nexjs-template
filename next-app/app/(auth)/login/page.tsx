import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { LoginForm } from "./_login-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your account",
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
