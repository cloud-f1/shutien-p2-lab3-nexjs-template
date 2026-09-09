"use server"

import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { sendInviteEmail } from "@/lib/email"
import { requireAdmin, requireAuth } from "@/lib/permissions"
import { rateLimitGuard } from "@/lib/rate-limit"
import { invitationsTable, usersTable, type Role } from "@/lib/schema"
import { generateInviteToken, inviteExpiry, isInviteValid } from "@/lib/team-utils"
import { toCsv } from "@/lib/export-utils"
import { teamMemberToExportRow, invitationToExportRow } from "@/lib/export-row-mappers"

const VALID_ROLES: Role[] = ["admin", "editor", "viewer"]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS

/** Invite a member by email with a role. Admin-only. Returns the invite token. */
export async function inviteMember(input: {
  email: string
  role: Role
}): Promise<{ token?: string; error?: string }> {
  const session = await requireAdmin()

  // 5 invites / hour per admin — blunts invite-email spam.
  const limited = rateLimitGuard(`team:invite:${session.user.id}`, 5, HOUR_MS)
  if (limited) return limited

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

  // Best-effort email delivery: a transport failure must not fail the invite —
  // the admin still receives the link to share manually.
  const inviteUrl = `${APP_URL}/invite/${token}`
  try {
    await sendInviteEmail(email, inviteUrl, session.user.name ?? "團隊管理員")
  } catch {
    // swallow — the returned token + admin UI link is the fallback channel
  }

  revalidatePath("/dashboard/admin")
  return { token }
}

/** Revoke a pending invitation. Admin-only. */
export async function revokeInvitation(id: string): Promise<{ error?: string }> {
  const session = await requireAdmin()

  const limited = rateLimitGuard(`team:revoke:${session.user.id}`, 20, MINUTE_MS)
  if (limited) return limited

  const result = await db
    .update(invitationsTable)
    .set({ status: "revoked" })
    .where(and(eq(invitationsTable.id, id), eq(invitationsTable.status, "pending")))

  // E368 — the WHERE also requires status='pending', so zero rows means the
  // invitation is missing OR already revoked/accepted. Reporting success (and
  // writing `invitation.revoked`) for a no-op made the audit trail claim a state
  // transition that never occurred.
  if (result.count === 0) {
    return { error: "找不到待處理的邀請（可能已被撤銷或已接受）。" }
  }

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

  // 10/min per user — prevents token-guessing brute-force on the accept path.
  const limited = rateLimitGuard(`team:accept:${session.user.id}`, 10, MINUTE_MS)
  if (limited) return limited

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

/**
 * Export all team members and pending invitations as CSV (admin only).
 * Combines users (members + roles + status) with invitation records.
 */
export async function exportTeam(): Promise<
  | { success: true; data: string; filename: string; contentType: string }
  | { success: false; error: string }
> {
  try {
    await requireAdmin()
  } catch {
    return { success: false, error: "權限不足。" }
  }

  const [members, invitations] = await Promise.all([
    db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        status: usersTable.status,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt)),
    db
      .select({
        id: invitationsTable.id,
        email: invitationsTable.email,
        role: invitationsTable.role,
        status: invitationsTable.status,
        expiresAt: invitationsTable.expiresAt,
        createdAt: invitationsTable.createdAt,
      })
      .from(invitationsTable)
      .orderBy(desc(invitationsTable.createdAt)),
  ])

  // Members sheet
  const memberRows = members.map(teamMemberToExportRow)
  const memberHeaders = ["id", "name", "email", "role", "status", "createdAt"]
  const membersCsv = toCsv(memberRows, memberHeaders)

  // Invitations sheet (appended after a blank separator line)
  const inviteRows = invitations.map(invitationToExportRow)
  const inviteHeaders = ["id", "email", "role", "status", "expiresAt", "createdAt"]
  const invitesCsv = toCsv(inviteRows, inviteHeaders)

  const data = `# Members\r\n${membersCsv}\r\n\r\n# Invitations\r\n${invitesCsv}`
  const filename = `team-${new Date().toISOString().slice(0, 10)}.csv`

  return { success: true, data, filename, contentType: "text/csv" }
}
