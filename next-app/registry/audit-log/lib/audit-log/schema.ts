// @saas/audit-log — immutable, append-only audit table (E323).
//
// Legal-grade trail: this module only ever INSERTs — there is no update/delete path.
// The actor snapshot is DENORMALIZED (actorRole / actorLabel captured at write time) so
// a row stays faithful even after the account is later renamed, re-roled, or deleted
// (the actorId FK is ON DELETE SET NULL; the snapshot columns preserve who it was).
// beforeValue / afterValue hold the full before/after state as jsonb.
//
// Note: the table is named `audit_log_entries` to sit ALONGSIDE the template's baked-in
// lightweight `audit_log` table (E269) rather than collide with it.
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { usersTable } from "@/lib/schema"

export const auditLogEntriesTable = pgTable(
  "audit_log_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Real actor even for act-on-behalf-of — responsibility attribution is the point.
    actorId: uuid("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
    // Denormalized snapshot — survives later role/name changes + account deletion.
    actorRole: text("actor_role"),
    actorLabel: text("actor_label"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    targetLabel: text("target_label"),
    beforeValue: jsonb("before_value"),
    afterValue: jsonb("after_value"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_entries_actor_id_idx").on(t.actorId),
    index("audit_log_entries_target_idx").on(t.targetType, t.targetId),
    index("audit_log_entries_created_at_idx").on(t.createdAt),
  ],
)

export type AuditLogEntry = typeof auditLogEntriesTable.$inferSelect
