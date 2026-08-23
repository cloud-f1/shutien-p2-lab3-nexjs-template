"use server"
/**
 * Usage metering Server Action — E301, narrowed by E346.
 *
 * `recordUsage` is the session-authenticated public write path for the
 * `usage_events` table. It is the metering FOUNDATION, not a pricing model: a
 * fork team calls it from whatever events matter for their product (an API
 * hit, a token spend, a seat added) and the billing panel reads the aggregate
 * back via lib/db/queries/usage.ts.
 *
 * SECURITY (E346): this action does NOT accept a `userId` parameter. Earlier
 * it did — as an "optional explicit owner for non-session contexts" — but
 * every exported function in a `"use server"` file is a public POST endpoint
 * reachable by any client, and passing `userId` made `requireAuth()` a no-op,
 * letting an unauthenticated caller forge usage rows for any user. The fix:
 * this action ALWAYS resolves the owner from the session, and the
 * non-session (Route Handler) case is served by the separate internal
 * `recordUsageFor` in `lib/usage.ts`, which trusts its caller to have already
 * authorized `userId` through its own mechanism (e.g. an API key). Never
 * re-widen this signature to accept a caller-supplied owner id again.
 */

import { requireAuth } from "@/lib/permissions"
import { recordUsageFor, type RecordUsageResult } from "@/lib/usage"

export type { RecordUsageResult }

/**
 * Append one usage event for the signed-in user.
 *
 * @param metric - The metered event name, e.g. "api_request".
 * @param delta - Units this event counts for (default 1).
 */
export async function recordUsage(metric: string, delta = 1): Promise<RecordUsageResult> {
  const session = await requireAuth()
  if (!session?.user?.id) {
    return { success: false, error: "請先登入。" }
  }

  return recordUsageFor(session.user.id, metric, delta)
}
