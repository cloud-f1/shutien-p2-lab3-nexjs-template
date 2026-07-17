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
import type { UtmParams } from "@/lib/analytics/funnel-utils"

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

/**
 * usage_events — append-only metering log (E301). One row per metered event;
 * `delta` lets a single row count for >1 unit. Aggregation (current-month usage
 * by metric) sums `delta` over rows in the period — see lib/db/queries/usage.ts.
 * This ships the plumbing, not a pricing model: fork teams attach their own
 * recordUsage() calls to whatever events matter for their product.
 */
export const usageEventsTable = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    /** Optional team scope — nullable until a fork wires team-level metering. */
    teamId: uuid("team_id"),
    /** The metered event name, e.g. "api_request" / "tokens" / "seats". */
    metric: text("metric").notNull(),
    /** Units this event counts for (default 1; e.g. token counts pass a delta). */
    delta: integer("delta").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("usage_events_user_id_idx").on(t.userId),
    index("usage_events_user_metric_created_idx").on(t.userId, t.metric, t.createdAt),
  ],
)

// ---------------------------------------------------------------------------
// One-time purchases — E327 products + orders (unified checkout)
// ---------------------------------------------------------------------------

/**
 * Order status values — the single source of truth for the `order_status` pgEnum.
 * A one-time order is created `pending`, transitions to `paid` exactly once on
 * settlement, or `failed` on a declined payment; `refunded` is a manual terminal.
 */
export const ORDER_STATUSES = ["pending", "paid", "failed", "refunded"] as const

/** Status values for a one-time order; providers/settlement MUST map to these. */
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const orderStatusEnum = pgEnum("order_status", ORDER_STATUSES)

/**
 * products — one row per sellable one-time digital product (course, template, …).
 * `amount` is in the smallest currency unit; `entitlement_key` is consumed by E328
 * to grant access once an order is paid.
 */
export const productsTable = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** URL-safe unique identifier used by the sales page + checkout. */
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  /** Price in the smallest currency unit (e.g. cents for USD; NTD is 1:1 for TWD). */
  amount: integer("amount").notNull(),
  /** ISO-4217 three-letter currency code. Defaults to TWD (sales gateway = ECPay). */
  currency: text("currency").notNull().default("TWD"),
  active: boolean("active").notNull().default(true),
  /** Entitlement granted on paid purchase (consumed by E328). */
  entitlementKey: text("entitlement_key"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
})

/**
 * orders — one row per one-time purchase attempt. `user_id` is NULLABLE to allow
 * guest checkout (purchase-by-email); `customer_email` is always captured.
 * Idempotent settlement rides the existing `payment_events.provider_event_id`
 * UNIQUE constraint — no new idempotency machinery (see lib/billing/orders.ts).
 */
export const ordersTable = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "restrict" }),
    /** Nullable — guest checkout keeps user_id null and links only by email. */
    userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    customerEmail: text("customer_email").notNull(),
    customerName: text("customer_name"),
    /** Which gateway processed the order (e.g. "stripe", "ecpay"). */
    provider: text("provider").notNull(),
    /** The gateway's own order/session/trade identifier (set on settlement). */
    providerOrderId: text("provider_order_id"),
    /** Amount charged in the smallest currency unit (snapshot of product.amount). */
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("TWD"),
    status: orderStatusEnum("status").notNull().default("pending"),
    /**
     * First-party UTM attribution captured on the sales-page visit and carried
     * through checkout (E334). Nullable JSONB — direct traffic / pre-E334 orders
     * have none. Powers the "which channel actually PAID" funnel breakdown.
     */
    utm: jsonb("utm").$type<UtmParams>(),
    paidAt: timestamp("paid_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("orders_product_id_idx").on(t.productId),
    index("orders_user_id_idx").on(t.userId),
    index("orders_provider_order_id_idx").on(t.providerOrderId),
  ],
)

export type Product = typeof productsTable.$inferSelect
export type NewProduct = typeof productsTable.$inferInsert
export type Order = typeof ordersTable.$inferSelect
export type NewOrder = typeof ordersTable.$inferInsert

export type Plan = typeof plansTable.$inferSelect
export type NewPlan = typeof plansTable.$inferInsert
export type Subscription = typeof subscriptionsTable.$inferSelect
export type NewSubscription = typeof subscriptionsTable.$inferInsert
export type PaymentEvent = typeof paymentEventsTable.$inferSelect
export type NewPaymentEvent = typeof paymentEventsTable.$inferInsert
export type UsageEvent = typeof usageEventsTable.$inferSelect
export type NewUsageEvent = typeof usageEventsTable.$inferInsert
