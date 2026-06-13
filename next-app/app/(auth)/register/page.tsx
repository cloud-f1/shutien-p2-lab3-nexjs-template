import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { RegisterForm } from "./_register-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create a new account",
}

export default async function RegisterPage() {
  const session = await auth()
  if (session) redirect("/dashboard")

  return <RegisterForm />
}
