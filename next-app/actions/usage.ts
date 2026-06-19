"use server"
/**
 * Usage metering Server Action — E301.
 *
 * `recordUsage` is the single write path for the `usage_events` table. It is the
 * metering FOUNDATION, not a pricing model: a fork team calls it from whatever
 * events matter for their product (an API hit, a token spend, a seat added) and
 * the billing panel reads the aggregate back via lib/db/queries/usage.ts.
 *
 * From a Server Component / form action, the caller is the signed-in user — call
 * `recordUsage("api_request")`. From a non-session context (e.g. an API-key
 * authed Route Handler) the owning user is already resolved, so pass it
 * explicitly — `recordUsage("api_request", 1, ownerUserId)`.
 */

import { db } from "@/lib/db"
import { requireAuth } from "@/lib/permissions"
import { usageEventsTable } from "@/lib/schema"

export interface RecordUsageResult {
  success: boolean
  error?: string
}

/**
 * Append one usage event.
 *
 * @param metric - The metered event name, e.g. "api_request".
 * @param delta - Units this event counts for (default 1).
 * @param userId - Optional explicit owner for non-session contexts (Route
 *   Handlers). Omit from a session context to attribute to the signed-in user.
 */
export async function recordUsage(
  metric: string,
  delta = 1,
  userId?: string,
): Promise<RecordUsageResult> {
  // Resolve the owning user: explicit (Route Handler) or the session (UI).
  let ownerId = userId
  if (!ownerId) {
    const session = await requireAuth()
    if (!session?.user?.id) {
      return { success: false, error: "請先登入。" }
    }
    ownerId = session.user.id
  }

  const trimmedMetric = metric?.trim()
  if (!trimmedMetric) {
    return { success: false, error: "metric is required" }
  }
  if (!Number.isFinite(delta)) {
    return { success: false, error: "delta must be a finite number" }
  }

  try {
    await db.insert(usageEventsTable).values({
      userId: ownerId,
      metric: trimmedMetric,
      delta,
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return { success: false, error: message }
  }
}
