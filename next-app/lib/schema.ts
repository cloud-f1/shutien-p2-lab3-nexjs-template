import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"

export const roleEnum = pgEnum("role", ["admin", "editor", "viewer"])
export type Role = "admin" | "editor" | "viewer"

// Auth.js v5 required tables (Drizzle adapter)
export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"), // null for OAuth-only users
  role: roleEnum("role").notNull().default("viewer"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
})

export const accountsTable = pgTable("accounts", {
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
})

export const sessionsTable = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokensTable = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

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

// Domain tables — add your own below
export const itemsTable = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
})

export type User = typeof usersTable.$inferSelect
// ---------------------------------------------------------------------------
// Billing tables — E231 PaymentProvider Abstraction
// ---------------------------------------------------------------------------

/** Billing interval enum — mirrors BillingInterval in lib/billing/provider.ts */
export const billingIntervalEnum = pgEnum("billing_interval", [
  "month",
  "year",
  "week",
  "day",
])

/** Subscription status enum — mirrors SubscriptionStatus in lib/billing/provider.ts */
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
])

/**
 * plans — one row per pricing tier offered to customers.
 * provider_price_id is the gateway's own price/product identifier.
 */
export const plansTable = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Gateway's own price identifier (e.g. Stripe price_xxx, ECPay PlanID). */
  providerPriceId: text("provider_price_id").notNull(),
  interval: billingIntervalEnum("interval").notNull(),
  /** Amount in the smallest currency unit (cents for USD, etc.). */
  amount: integer("amount").notNull(),
  /** ISO-4217 three-letter currency code, lower-case. */
  currency: text("currency").notNull().default("usd"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
})

/**
 * subscriptions — one row per user–plan binding.
 *
 * provider_meta is a free-form JSONB column for provider-specific tracking state
 * that doesn't fit the shared typed columns:
 *   ECPay: { exec_times, total_success_times, exec_status }
 *   Stripe: { current_period_end }
 */
export const subscriptionsTable = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plansTable.id, { onDelete: "restrict" }),
  /** Which gateway owns this subscription (e.g. "stripe", "ecpay"). */
  provider: text("provider").notNull(),
  /** The gateway's own subscription identifier. */
  providerSubId: text("provider_sub_id").notNull(),
  status: subscriptionStatusEnum("status").notNull().default("incomplete"),
  /** Unix timestamp (seconds) when the current billing period ends. */
  currentPeriodEnd: timestamp("current_period_end", { mode: "date" }),
  /** Unix timestamp (seconds) when the subscription will be canceled, if scheduled. */
  cancelAt: timestamp("cancel_at", { mode: "date" }),
  /**
   * Provider-specific metadata in free-form shape.
   * ECPay: { exec_times, total_success_times, exec_status }
   * Stripe: { current_period_end }
   */
  providerMeta: jsonb("provider_meta").notNull().default({}),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
})

/**
 * payment_events — idempotency log shared by all providers.
 *
 * provider_event_id is UNIQUE to guarantee exactly-once processing:
 * insert-or-ignore on this ID before dispatching any webhook handler.
 */
export const paymentEventsTable = pgTable(
  "payment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Which gateway emitted this event (e.g. "stripe", "ecpay"). */
    provider: text("provider").notNull(),
    /**
     * Gateway-specific event identifier.
     * UNIQUE constraint enforces idempotency: duplicate webhooks are safe to retry.
     */
    providerEventId: text("provider_event_id").notNull(),
    /** Event type string (e.g. "invoice.payment_succeeded", "CheckoutTradeNo"). */
    type: text("type").notNull(),
    /** Raw parsed event payload from the gateway. */
    payload: jsonb("payload").notNull().default({}),
    /** When the event was successfully processed; null if pending/failed. */
    processedAt: timestamp("processed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [unique("payment_events_provider_event_id_unique").on(table.providerEventId)],
)

export type Plan = typeof plansTable.$inferSelect
export type NewPlan = typeof plansTable.$inferInsert
export type Subscription = typeof subscriptionsTable.$inferSelect
export type NewSubscription = typeof subscriptionsTable.$inferInsert
export type PaymentEvent = typeof paymentEventsTable.$inferSelect
export type NewPaymentEvent = typeof paymentEventsTable.$inferInsert
