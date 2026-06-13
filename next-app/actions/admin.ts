"use server"

import { db } from "@/lib/db"
import { usersTable } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/permissions"
import type { Role } from "@/lib/schema"

const VALID_ROLES: Role[] = ["admin", "editor", "viewer"]

export async function setUserRole(userId: string, role: Role) {
  const session = await requireAdmin()

  // Runtime allowlist: TS types are erased, and Server Actions are public
  // POST endpoints — a crafted request could pass an arbitrary string.
  if (!VALID_ROLES.includes(role)) {
    return { error: "無效的角色。" }
  }

  // Prevent admin from demoting themselves
  if (userId === session.user.id) {
    return { error: "您無法變更自己的角色。" }
  }

  await db.update(usersTable).set({ role, updatedAt: new Date() }).where(eq(usersTable.id, userId))

  revalidatePath("/dashboard/admin")
  return { success: true }
}

export async function deleteUser(userId: string) {
  const session = await requireAdmin()

  if (userId === session.user.id) {
    return { error: "您無法刪除自己的帳戶。" }
  }

  await db.delete(usersTable).where(eq(usersTable.id, userId))

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
