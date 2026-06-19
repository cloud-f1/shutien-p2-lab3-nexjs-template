"use server"

import { db } from "@/lib/db"
import { usersTable } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"
import type { Role } from "@/lib/schema"
import { isValidRole, assertNotSelf, assertNotSelfDelete } from "@/lib/admin-utils"
import { rateLimitGuard } from "@/lib/rate-limit"

const MINUTE_MS = 60_000

export async function setUserRole(userId: string, role: Role) {
  const session = await requireAdmin()

  // 20 destructive admin ops / minute per admin.
  const limited = rateLimitGuard(`admin:role:${session.user.id}`, 20, MINUTE_MS)
  if (limited) return limited

  // Runtime allowlist: TS types are erased, and Server Actions are public
  // POST endpoints — a crafted request could pass an arbitrary string.
  if (!isValidRole(role)) {
    return { error: "無效的角色。" }
  }

  // Prevent admin from demoting themselves
  const selfErr = assertNotSelf(session.user.id, userId)
  if (selfErr) {
    return { error: selfErr }
  }

  await db.update(usersTable).set({ role, updatedAt: new Date() }).where(eq(usersTable.id, userId))
  await logAudit({
    actorId: session.user.id,
    action: "user.role_changed",
    targetType: "user",
    targetId: userId,
    metadata: { role },
  })

  revalidatePath("/dashboard/admin")
  return { success: true }
}

export async function deleteUser(userId: string) {
  const session = await requireAdmin()

  const limited = rateLimitGuard(`admin:delete:${session.user.id}`, 20, MINUTE_MS)
  if (limited) return limited

  const selfDeleteErr = assertNotSelfDelete(session.user.id, userId)
  if (selfDeleteErr) {
    return { error: selfDeleteErr }
  }

  await db.delete(usersTable).where(eq(usersTable.id, userId))
  await logAudit({
    actorId: session.user.id,
    action: "user.deleted",
    targetType: "user",
    targetId: userId,
  })

  revalidatePath("/dashboard/admin")
  return { success: true }
}

export async function getAllUsers() {
  await requireAdmin()
  return db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      emailVerified: usersTable.emailVerified,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt)
}
