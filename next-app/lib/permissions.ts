import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { Session } from "next-auth"

export { isAdmin } from "@/lib/is-admin"

// Server-only — call only from Server Components or Server Actions
export async function requireAuth(): Promise<Session> {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  return session as Session
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireAuth()
  if (session.user.role !== "admin") redirect("/dashboard")
  return session
}
