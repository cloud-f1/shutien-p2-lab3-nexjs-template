import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

import { roleEnum, usersTable } from "./auth"

// ---------------------------------------------------------------------------
// System surfaces — E267–E272 (api keys, webhooks, audit, invites, notifications)
// ---------------------------------------------------------------------------

/** E267 — API keys. Only a hash is stored; plaintext is shown once at creation. */
export const apiKeysTable = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(), // shown in the UI; used to look up the row
    hashedKey: text("hashed_key").notNull(), // sha256 of the secret
    scopes: text("scopes").array().notNull().default([]),
    lastUsedAt: timestamp("last_used_at", { mode: "date" }),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique("api_keys_prefix_unique").on(t.prefix),
    index("api_keys_user_id_idx").on(t.userId),
  ],
)

/** E268 — outbound webhook subscriptions. */
export const webhooksTable = pgTable(
  "webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    events: text("events").array().notNull().default([]),
    secret: text("secret").notNull(), // HMAC-SHA256 signing secret
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("webhooks_user_id_idx").on(t.userId)],
)

/** E268 — per-attempt delivery record for a webhook. */
export const webhookDeliveriesTable = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhooksTable.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    status: text("status").notNull().default("pending"), // pending | success | failed
    responseCode: integer("response_code"),
    attempts: integer("attempts").notNull().default(0),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("webhook_deliveries_webhook_id_idx").on(t.webhookId)],
)

/** E269 — audit trail for sensitive actions. */
export const auditLogTable = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
    action: text("action").notNull(), // e.g. "user.role_changed"
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_actor_id_idx").on(t.actorId)],
)

/** E270 — team invitations. */
export const invitationStatusEnum = pgEnum("invitation_status", ["pending", "accepted", "revoked"])
export const invitationsTable = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    role: roleEnum("role").notNull().default("viewer"),
    token: text("token").notNull().unique(),
    status: invitationStatusEnum("status").notNull().default("pending"),
    invitedBy: uuid("invited_by").references(() => usersTable.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("invitations_email_idx").on(t.email),
    index("invitations_invited_by_idx").on(t.invitedBy),
  ],
)

/** E272 — per-user notifications. */
export const notificationTypeEnum = pgEnum("notification_type", [
  "info",
  "success",
  "warning",
  "error",
])
export const notificationsTable = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body"),
    type: notificationTypeEnum("type").notNull().default("info"),
    readAt: timestamp("read_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_id_idx").on(t.userId)],
)

export type ApiKey = typeof apiKeysTable.$inferSelect
export type Webhook = typeof webhooksTable.$inferSelect
export type WebhookDelivery = typeof webhookDeliveriesTable.$inferSelect
export type AuditLog = typeof auditLogTable.$inferSelect
export type Invitation = typeof invitationsTable.$inferSelect
export type Notification = typeof notificationsTable.$inferSelect
