import { and, desc, eq, inArray } from "drizzle-orm"

import { db } from "@/lib/db"
import { plansTable, subscriptionsTable, type Plan, type Subscription } from "@/lib/schema"

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
