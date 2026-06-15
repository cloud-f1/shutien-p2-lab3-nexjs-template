import { desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { auditLogTable, usersTable, type AuditLog } from "@/lib/schema"

/**
 * Record a sensitive action (E269). Fire-and-forget: NEVER throws into the
 * caller — an audit failure must not break the action it's recording.
 */
export async function logAudit(entry: {
  actorId?: string | null
  action: string
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    await db.insert(auditLogTable).values({
      actorId: entry.actorId ?? null,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata ?? {},
    })
  } catch {
    // swallow — auditing is best-effort
  }
}

export type AuditEntry = AuditLog & { actorEmail: string | null }

/** Recent audit entries with the actor's email joined (admin viewer). */
export async function getAuditLog(limit = 100): Promise<AuditEntry[]> {
  const rows = await db
    .select({
      id: auditLogTable.id,
      actorId: auditLogTable.actorId,
      action: auditLogTable.action,
      targetType: auditLogTable.targetType,
      targetId: auditLogTable.targetId,
      metadata: auditLogTable.metadata,
      createdAt: auditLogTable.createdAt,
      actorEmail: usersTable.email,
    })
    .from(auditLogTable)
    .leftJoin(usersTable, eq(auditLogTable.actorId, usersTable.id))
    .orderBy(desc(auditLogTable.createdAt))
    .limit(limit)
  return rows as AuditEntry[]
}
