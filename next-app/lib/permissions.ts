import { auth } from "@/lib/auth"
import { getUserById } from "@/lib/queries"
import { redirect } from "next/navigation"
import type { Session } from "next-auth"
import type { Role } from "@/lib/schema"

export { isAdmin, canEdit } from "@/lib/is-admin"

// Server-only — call only from Server Components or Server Actions
export async function requireAuth(): Promise<Session> {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  return session as Session
}

// Re-read the role from the DB rather than trusting session.user.role, which is
// snapshotted into the JWT at sign-in. This makes demotions (setUserRole) take
// effect immediately instead of waiting for the user to sign in again. If the
// user row vanished (deleted account), treat as no role.
async function getLiveRole(userId: string): Promise<Role | undefined> {
  const user = await getUserById(userId)
  return user?.role
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireAuth()
  const role = await getLiveRole(session.user.id)
  if (role !== "admin") redirect("/dashboard")
  return session
}

// Allows admins and editors through; viewers are redirected to the dashboard.
// Use to gate item create/update/delete server actions.
export async function requireEditor(): Promise<Session> {
  const session = await requireAuth()
  const role = await getLiveRole(session.user.id)
  if (role !== "admin" && role !== "editor") {
    redirect("/dashboard")
  }
  return session
}
