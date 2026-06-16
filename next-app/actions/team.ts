"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { requireAdmin, requireAuth } from "@/lib/permissions"
import { invitationsTable, usersTable, type Role } from "@/lib/schema"
import { generateInviteToken, inviteExpiry, isInviteValid } from "@/lib/team-utils"

const VALID_ROLES: Role[] = ["admin", "editor", "viewer"]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Invite a member by email with a role. Admin-only. Returns the invite token. */
export async function inviteMember(input: {
  email: string
  role: Role
}): Promise<{ token?: string; error?: string }> {
  const session = await requireAdmin()
  const email = input.email?.trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) return { error: "請輸入有效的電子郵件。" }
  if (!VALID_ROLES.includes(input.role)) return { error: "無效的角色。" }

  // Don't invite someone who already has an account.
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1)
  if (existing) return { error: "此電子郵件已是成員。" }

  const token = generateInviteToken()
  const now = new Date()
  await db.insert(invitationsTable).values({
    email,
    role: input.role,
    token,
    invitedBy: session.user.id,
    expiresAt: inviteExpiry(now),
  })
  await logAudit({
    actorId: session.user.id,
    action: "invitation.created",
    targetType: "invitation",
    metadata: { email, role: input.role },
  })

  revalidatePath("/dashboard/admin")
  return { token }
}

/** Revoke a pending invitation. Admin-only. */
export async function revokeInvitation(id: string): Promise<{ error?: string }> {
  const session = await requireAdmin()
  await db
    .update(invitationsTable)
    .set({ status: "revoked" })
    .where(and(eq(invitationsTable.id, id), eq(invitationsTable.status, "pending")))
  await logAudit({
    actorId: session.user.id,
    action: "invitation.revoked",
    targetType: "invitation",
    targetId: id,
  })
  revalidatePath("/dashboard/admin")
  return {}
}

/**
 * Accept an invitation. The caller must be signed in with the invited email.
 * Applies the invited role + activates the membership, then marks the invite accepted.
 */
export async function acceptInvitation(token: string): Promise<{ error?: string; ok?: boolean }> {
  const session = await requireAuth()

  const [invite] = await db
    .select()
    .from(invitationsTable)
    .where(eq(invitationsTable.token, token))
    .limit(1)
  if (!invite) return { error: "邀請不存在。" }
  if (!isInviteValid(invite, new Date())) return { error: "邀請已失效或過期。" }

  const [me] = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, session.user.id))
    .limit(1)
  if (!me || me.email.toLowerCase() !== invite.email.toLowerCase()) {
    return { error: "此邀請是寄給其他電子郵件的。" }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(usersTable)
      .set({ role: invite.role, status: "active", updatedAt: new Date() })
      .where(eq(usersTable.id, session.user.id))
    await tx
      .update(invitationsTable)
      .set({ status: "accepted" })
      .where(eq(invitationsTable.id, invite.id))
  })
  await logAudit({
    actorId: session.user.id,
    action: "invitation.accepted",
    targetType: "invitation",
    targetId: invite.id,
    metadata: { role: invite.role },
  })

  revalidatePath("/dashboard")
  return { ok: true }
}
