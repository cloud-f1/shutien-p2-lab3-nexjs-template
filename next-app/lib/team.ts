import { desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { invitationsTable, usersTable, type Invitation } from "@/lib/schema"

export {
  CAPABILITIES,
  PERMISSION_MATRIX,
  can,
  generateInviteToken,
  inviteExpiry,
  isInviteValid,
} from "@/lib/team-utils"

export type InvitationRow = Invitation & { inviterEmail: string | null }

/** All invitations (newest first) with the inviter's email — admin viewer. */
export async function listInvitations(limit = 100): Promise<InvitationRow[]> {
  const rows = await db
    .select({
      id: invitationsTable.id,
      email: invitationsTable.email,
      role: invitationsTable.role,
      token: invitationsTable.token,
      status: invitationsTable.status,
      invitedBy: invitationsTable.invitedBy,
      expiresAt: invitationsTable.expiresAt,
      createdAt: invitationsTable.createdAt,
      inviterEmail: usersTable.email,
    })
    .from(invitationsTable)
    .leftJoin(usersTable, eq(invitationsTable.invitedBy, usersTable.id))
    .orderBy(desc(invitationsTable.createdAt))
    .limit(limit)
  return rows as InvitationRow[]
}

/** Look up a single invitation by its opaque token, or null. */
export async function getInvitationByToken(token: string): Promise<Invitation | null> {
  if (!token) return null
  const [row] = await db
    .select()
    .from(invitationsTable)
    .where(eq(invitationsTable.token, token))
    .limit(1)
  return row ?? null
}
