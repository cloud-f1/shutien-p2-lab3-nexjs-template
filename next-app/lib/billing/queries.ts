import { and, count, desc, eq, inArray } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  ordersTable,
  plansTable,
  productsTable,
  subscriptionsTable,
  usersTable,
  type OrderStatus,
  type Plan,
  type Subscription,
} from "@/lib/schema"
import { resolvePagination, type PageParams } from "@/lib/billing/pagination"

export { formatAmount, subscriptionStatusLabel } from "@/lib/billing/billing-utils"

export type ActiveSubscription = { subscription: Subscription; plan: Plan } | null

/** The current user's live subscription + its plan, or null. Owner-scoped. */
export async function getActiveSubscription(userId: string): Promise<ActiveSubscription> {
  const [row] = await db
    .select({ subscription: subscriptionsTable, plan: plansTable })
    .from(subscriptionsTable)
    .innerJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(
      and(
        eq(subscriptionsTable.userId, userId),
        inArray(subscriptionsTable.status, ["active", "trialing", "past_due"]),
      ),
    )
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(1)
  return row ?? null
}

// ---------------------------------------------------------------------------
// Admin revenue console (E331) — site-wide, admin-only read queries. These are
// NOT owner-scoped (an admin sees every buyer's rows); the admin gate lives at
// the call site (server component requireAdmin / server action allow:isAdmin).
// Paginated via the pure resolvePagination() so the bounds logic is tested once.
// ---------------------------------------------------------------------------

/** One row of the site-wide orders table (order + product name + buyer). */
export interface AdminOrderRow {
  id: string
  productId: string
  productName: string | null
  customerEmail: string
  customerName: string | null
  amount: number
  currency: string
  provider: string
  providerOrderId: string | null
  status: OrderStatus
  createdAt: Date
  paidAt: Date | null
  userId: string | null
}

/** A page of site-wide orders + the unfiltered total (for page-count display). */
export async function listAllOrders(
  params?: PageParams,
): Promise<{ rows: AdminOrderRow[]; total: number }> {
  const { limit, offset } = resolvePagination(params)
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: ordersTable.id,
        productId: ordersTable.productId,
        productName: productsTable.name,
        customerEmail: ordersTable.customerEmail,
        customerName: ordersTable.customerName,
        amount: ordersTable.amount,
        currency: ordersTable.currency,
        provider: ordersTable.provider,
        providerOrderId: ordersTable.providerOrderId,
        status: ordersTable.status,
        createdAt: ordersTable.createdAt,
        paidAt: ordersTable.paidAt,
        userId: ordersTable.userId,
      })
      .from(ordersTable)
      .leftJoin(productsTable, eq(ordersTable.productId, productsTable.id))
      .orderBy(desc(ordersTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(ordersTable),
  ])
  return { rows, total: Number(total) }
}

/** Every order for a single buyer, newest first — powers the member-detail view. */
export async function listOrdersForUser(userId: string): Promise<AdminOrderRow[]> {
  if (!userId) return []
  return db
    .select({
      id: ordersTable.id,
      productId: ordersTable.productId,
      productName: productsTable.name,
      customerEmail: ordersTable.customerEmail,
      customerName: ordersTable.customerName,
      amount: ordersTable.amount,
      currency: ordersTable.currency,
      provider: ordersTable.provider,
      providerOrderId: ordersTable.providerOrderId,
      status: ordersTable.status,
      createdAt: ordersTable.createdAt,
      paidAt: ordersTable.paidAt,
      userId: ordersTable.userId,
    })
    .from(ordersTable)
    .leftJoin(productsTable, eq(ordersTable.productId, productsTable.id))
    .where(eq(ordersTable.userId, userId))
    .orderBy(desc(ordersTable.createdAt))
}

/** One row of the site-wide subscriptions table (subscription + user + plan). */
export interface AdminSubscriptionRow {
  id: string
  userId: string
  userEmail: string | null
  userName: string | null
  provider: string
  status: string
  interval: string | null
  amount: number | null
  currency: string | null
  currentPeriodEnd: Date | null
  createdAt: Date
}

/** A page of site-wide subscriptions + the unfiltered total. Read-only. */
export async function listAllSubscriptions(
  params?: PageParams,
): Promise<{ rows: AdminSubscriptionRow[]; total: number }> {
  const { limit, offset } = resolvePagination(params)
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: subscriptionsTable.id,
        userId: subscriptionsTable.userId,
        userEmail: usersTable.email,
        userName: usersTable.name,
        provider: subscriptionsTable.provider,
        status: subscriptionsTable.status,
        interval: plansTable.interval,
        amount: plansTable.amount,
        currency: plansTable.currency,
        currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
        createdAt: subscriptionsTable.createdAt,
      })
      .from(subscriptionsTable)
      .leftJoin(usersTable, eq(subscriptionsTable.userId, usersTable.id))
      .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(subscriptionsTable),
  ])
  return { rows, total: Number(total) }
}
