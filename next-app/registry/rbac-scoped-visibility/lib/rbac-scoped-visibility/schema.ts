// @saas/rbac-scoped-visibility — M:N assignment table pattern (E325).
//
// Generic across any assignable resource: `resourceType` + `resourceId` (mirrors the
// audit-log module's `targetType`/`targetId` convention) rather than a hardcoded FK, so
// this fragment installs standalone without depending on a domain-specific table. If
// you only ever scope ONE resource table, consider swapping `resourceId`'s text()
// column for a real FK to that table for referential integrity.
//
// Query this table server-side (e.g. `WHERE resourceType = 'item' AND userId = ?`) to
// build the `assigneeIds` list that `./visibility.ts`'s `canSeeAssignedRow()` consumes.
import { index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { usersTable } from "@/lib/schema"

export const resourceAssigneesTable = pgTable(
  "resource_assignees",
  {
    // Internal classification of the assigned resource, e.g. "item" / "case" / "ticket".
    resourceType: text("resource_type").notNull(),
    // The assigned resource's id (kept as text so this fragment has no FK to a
    // domain-specific table — swap for a real FK if you only ever scope one table).
    resourceId: text("resource_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.resourceType, t.resourceId, t.userId] }),
    index("resource_assignees_resource_idx").on(t.resourceType, t.resourceId),
    index("resource_assignees_user_idx").on(t.userId),
  ],
)

export type ResourceAssignee = typeof resourceAssigneesTable.$inferSelect
