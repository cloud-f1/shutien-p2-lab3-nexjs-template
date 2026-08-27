"use server"

import { db } from "@/lib/db"
import { usersTable } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/permissions"
import { logAudit, getAuditLog } from "@/lib/audit"
import type { Role } from "@/lib/schema"
import { isValidRole, assertNotSelf, assertNotSelfDelete } from "@/lib/admin-utils"
import { rateLimitGuard } from "@/lib/rate-limit"
import { toCsv } from "@/lib/export-utils"

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
    // E356 — admin panel action against ANOTHER user's account. assertNotSelf()
    // above already refuses a self-target, so this is true in every reachable
    // case; it is written as the actor≠target comparison anyway so the flag
    // stays correct if that guard is ever relaxed.
    onBehalf: session.user.id !== userId,
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
    // E356 — same shape as setUserRole: admin panel, another user's account
    // (assertNotSelfDelete() forbids self-deletion).
    onBehalf: session.user.id !== userId,
  })

  revalidatePath("/dashboard/admin")
  return { success: true }
}

/**
 * E310 — Admin-assisted 2FA recovery. Clears the target user's TOTP secret,
 * the enabled flag, and any remaining backup codes so a user who lost their
 * authenticator AND their backup codes can sign in again (they may re-enrol
 * afterwards). Admin-gated (requireAdmin) + audit-logged. There is no
 * self-target guard: an admin who locks themselves out of 2FA is a legitimate
 * recovery case.
 */
export async function resetUserTotp(userId: string) {
  const session = await requireAdmin()

  const limited = rateLimitGuard(`admin:reset-2fa:${session.user.id}`, 20, MINUTE_MS)
  if (limited) return limited

  await db
    .update(usersTable)
    .set({
      totpSecret: null,
      totpEnabled: false,
      backupCodes: null,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId))

  await logAudit({
    actorId: session.user.id,
    action: "user.totp_reset",
    targetType: "user",
    targetId: userId,
    // E356 — the ONE admin action here with no self-target guard (an admin who
    // loses their own authenticator is a legitimate recovery case), so this is
    // the call site where the comparison genuinely varies at runtime:
    // recovering someone else ⇒ true, recovering your own 2FA ⇒ false.
    onBehalf: session.user.id !== userId,
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
      totpEnabled: usersTable.totpEnabled,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt)
}

/**
 * Export all audit log entries as CSV (admin only).
 * Returns the CSV string, suggested filename, and content-type so the client
 * can trigger a browser download without a streaming response.
 */
export async function exportAuditLog(): Promise<
  | { success: true; data: string; filename: string; contentType: string }
  | { success: false; error: string }
> {
  try {
    await requireAdmin()
  } catch {
    return { success: false, error: "權限不足。" }
  }

  const entries = await getAuditLog(10_000)

  const rows = entries.map((e) => ({
    id: e.id,
    action: e.action,
    actorEmail: e.actorEmail ?? "",
    targetType: e.targetType ?? "",
    targetId: e.targetId ?? "",
    // E359 — the UI's 稽核紀錄 panel already surfaces this per row (代操作／本人操作
    // badge, E356); the CSV export is offline-investigation/compliance delivery, the
    // scenario that most needs the flag, so it must not silently drop it.
    onBehalf: e.onBehalf,
    createdAt: e.createdAt.toISOString(),
  }))

  const headers = ["id", "action", "actorEmail", "targetType", "targetId", "onBehalf", "createdAt"]
  const data = toCsv(rows, headers)
  const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`

  return { success: true, data, filename, contentType: "text/csv" }
}
