import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { usersTable } from "./auth"

// Domain tables — add your own here (or scaffold via `make new-domain`).
export const itemsTable = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("items_user_id_idx").on(t.userId)],
)

export type Item = typeof itemsTable.$inferSelect
