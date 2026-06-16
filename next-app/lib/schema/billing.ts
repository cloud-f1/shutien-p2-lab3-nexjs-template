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

import { BILLING_INTERVALS, SUBSCRIPTION_STATUSES } from "@/lib/billing/provider"

import { usersTable } from "./auth"

// ---------------------------------------------------------------------------
// Billing — E231 PaymentProvider abstraction (E274 hardening)
// ---------------------------------------------------------------------------

/**
 * Billing interval enum — derived from BILLING_INTERVALS in lib/billing/provider.ts
 * (single source of truth; the DB enum and the TS type can never drift).
 */
export const billingIntervalEnum = pgEnum("billing_interval", BILLING_INTERVALS)

/**
 * Subscription status enum — derived from SUBSCRIPTION_STATUSES in
 * lib/billing/provider.ts (single source of truth).
 */
export const subscriptionStatusEnum = pgEnum("subscription_status", SUBSCRIPTION_STATUSES)

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
