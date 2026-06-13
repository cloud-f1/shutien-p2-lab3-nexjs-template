import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { Session } from "next-auth"

export { isAdmin, canEdit } from "@/lib/is-admin"

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

// Allows admins and editors through; viewers are redirected to the dashboard.
// Use to gate item create/update/delete server actions.
export async function requireEditor(): Promise<Session> {
  const session = await requireAuth()
  if (session.user.role !== "admin" && session.user.role !== "editor") {
    redirect("/dashboard")
  }
  return session
}
