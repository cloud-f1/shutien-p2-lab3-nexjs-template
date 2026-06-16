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

import { usersTable } from "./auth"

// ---------------------------------------------------------------------------
// Billing — E231 PaymentProvider abstraction (E274 hardening)
// ---------------------------------------------------------------------------

/** Billing interval enum — mirrors BillingInterval in lib/billing/provider.ts */
export const billingIntervalEnum = pgEnum("billing_interval", ["month", "year", "week", "day"])

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

/** plans — one row per pricing tier (seeded from config/pricing.json). */
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
 * provider_sub_id is UNIQUE so webhooks can `onConflictDoUpdate` (idempotent,
 * race-safe). provider_meta holds gateway-specific tracking state.
 */
export const subscriptionsTable = pgTable(
  "subscriptions",
  {
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
    currentPeriodEnd: timestamp("current_period_end", { mode: "date" }),
    cancelAt: timestamp("cancel_at", { mode: "date" }),
    providerMeta: jsonb("provider_meta").notNull().default({}),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique("subscriptions_provider_sub_id_unique").on(t.providerSubId),
    index("subscriptions_user_id_idx").on(t.userId),
  ],
)

/**
 * payment_events — idempotency log shared by all providers.
 * provider_event_id is UNIQUE to guarantee exactly-once processing.
 */
export const paymentEventsTable = pgTable(
  "payment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    processedAt: timestamp("processed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [unique("payment_events_provider_event_id_unique").on(t.providerEventId)],
)

export type Plan = typeof plansTable.$inferSelect
export type NewPlan = typeof plansTable.$inferInsert
export type Subscription = typeof subscriptionsTable.$inferSelect
export type NewSubscription = typeof subscriptionsTable.$inferInsert
export type PaymentEvent = typeof paymentEventsTable.$inferSelect
export type NewPaymentEvent = typeof paymentEventsTable.$inferInsert
