import { and, eq, gte, lt, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { usageEventsTable } from "@/lib/schema"
import { getUsagePeriod } from "@/lib/usage-utils"

/**
 * Current-month usage for one user + metric (E301).
 *
 * Sums `delta` over the user's `usage_events` rows for `metric` that fall within
 * the current calendar month (the half-open [start, end) window from
 * getUsagePeriod). The SUM runs in Postgres — far cheaper than loading every row
 * into Node — and COALESCE(..., 0) means a user with no events reads back 0.
 *
 * @param userId - The owning user's id (rows are always user-scoped).
 * @param metric - The metered event name, e.g. "api_request".
 * @returns The total units consumed this month (>= 0).
 */
export async function getCurrentMonthUsage(userId: string, metric: string): Promise<number> {
  const { start, end } = getUsagePeriod()

  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${usageEventsTable.delta}), 0)`.mapWith(Number),
    })
    .from(usageEventsTable)
    .where(
      and(
        eq(usageEventsTable.userId, userId),
        eq(usageEventsTable.metric, metric),
        gte(usageEventsTable.createdAt, start),
        lt(usageEventsTable.createdAt, end),
      ),
    )

  return row?.total ?? 0
}
