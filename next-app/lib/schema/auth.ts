import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

// 3-tier RBAC role + member lifecycle (E270). roleEnum is also used by invitations
// (lib/schema/system.ts) — defined here once (Postgres enum types are global).
export const roleEnum = pgEnum("role", ["admin", "editor", "viewer"])
export type Role = "admin" | "editor" | "viewer"

export const memberStatusEnum = pgEnum("member_status", ["active", "invited", "suspended"])

// Auth.js v5 required tables (Drizzle adapter)
export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"), // null for OAuth-only users
  role: roleEnum("role").notNull().default("viewer"),
  // E270 — member lifecycle (active by default; invited rows created via invitations)
  status: memberStatusEnum("status").notNull().default("active"),
  // E297 — TOTP 2FA. `totpSecret` is the base32 shared secret (null until set up);
  // it is only authoritative when `totpEnabled` is true (verified during setup).
  // `backupCodes` holds bcrypt hashes of one-time recovery codes — each is deleted
  // from the array as it is consumed.
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  backupCodes: text("backup_codes").array(),
  // E310 — server-side onboarding persistence (DB is source of truth; the
  // useOnboarding hook keeps localStorage only as an optimistic layer).
  // `onboardingCompletedAt` is set when every checklist step is done;
  // `onboardingDismissed` when the user explicitly closes the card.
  onboardingCompletedAt: timestamp("onboarding_completed_at", { mode: "date" }),
  onboardingDismissed: boolean("onboarding_dismissed").notNull().default(false),
  // E355 — persistent login lockout. A SECOND layer over the in-memory throttle
  // in lib/rate-limit.ts: consecutive failed-password attempts accumulate here,
  // so a lockout survives a process restart / serverless instance recycle.
  // Reset to 0 on a successful password verification.
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  // Non-null AND in the future ⇒ the account is locked until this instant.
  // timestamptz so the stored instant is unambiguous to raw-SQL readers too
  // (integration tests read this column directly via postgres-js).
  lockedUntil: timestamp("locked_until", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
})

export const accountsTable = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"), // Unix timestamp seconds (Auth.js adapter contract)
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  // Auth.js Drizzle-adapter contract: composite PK on (provider, providerAccountId).
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
)

export const sessionsTable = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokensTable = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  // Auth.js contract: composite PK on (identifier, token).
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
)

// Email verification tokens for credentials auth
export const emailVerificationTokensTable = pgTable("email_verification_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
})

// Password reset tokens for credentials auth (E290) — mirrors
// emailVerificationTokens. A token is single-use: consumed (deleted) on a
// successful reset and on expiry.
export const passwordResetTokensTable = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
})

export type User = typeof usersTable.$inferSelect
