// @saas/audit-log — the write entry point (E323).
//
// Fire-and-forget: NEVER throws into the caller — an audit failure must not break the
// action it records. Append-only: this module has no update/delete path. The actor
// snapshot (role + label) is captured at write time so the row stays faithful forever.
//
// Actor resolution priority: explicit `actor` arg > the current session's user. For
// act-on-behalf-of flows, pass the REAL logged-in operator as `actor` — recording who
// actually performed the action is the whole point of the table.
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getUserById } from "@/lib/queries"

import { auditLogEntriesTable } from "./schema"

export interface AuditLogInput {
  /** Action verb, e.g. "item.deleted" / "user.role_changed". */
  action: string
  /** Internal target classification, e.g. "item" / "user". */
  targetType?: string
  /** Target program key (id). */
  targetId?: string
  /** Human-readable target label, e.g. "Invoice #1042". */
  targetLabel?: string
  /** Before value (jsonb). */
  before?: Record<string, unknown> | null
  /** After value (jsonb). */
  after?: Record<string, unknown> | null
  /** Explicit actor; omitted → resolved from the session. */
  actor?: { id?: string | null; role?: string | null; label?: string | null }
  /** Extra structured notes. */
  metadata?: Record<string, unknown>
}

export async function log(entry: AuditLogInput): Promise<void> {
  try {
    let actorId = entry.actor?.id ?? null
    let actorRole = entry.actor?.role ?? null
    let actorLabel = entry.actor?.label ?? null

    // Fill any missing actor fields from the session's user row (denormalized snapshot).
    if (!actorId || actorRole == null || actorLabel == null) {
      const session = await auth()
      const sessionUserId = session?.user?.id ?? null
      if (!actorId) actorId = sessionUserId
      if ((actorRole == null || actorLabel == null) && sessionUserId) {
        const user = await getUserById(sessionUserId)
        if (user) {
          if (actorRole == null) actorRole = user.role ?? null
          if (actorLabel == null) actorLabel = user.name ?? user.email ?? null
        }
      }
    }

    await db.insert(auditLogEntriesTable).values({
      actorId,
      actorRole,
      actorLabel,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      targetLabel: entry.targetLabel,
      beforeValue: entry.before ?? null,
      afterValue: entry.after ?? null,
      metadata: entry.metadata ?? {},
    })
  } catch {
    // best-effort — an audit write failure must never break the recorded action.
  }
}
