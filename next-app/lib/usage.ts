/**
 * Usage metering — internal write path (E301, narrowed by E346).
 *
 * TRUST BOUNDARY: `recordUsageFor` takes an explicit `userId` and performs
 * NO authentication or authorization check of its own — it trusts the caller
 * to have already verified that `userId` is who it claims to be. Call it only
 * from Route Handlers or other genuinely server-side contexts that have
 * already resolved the owning user through their own auth mechanism (e.g. an
 * API-key-verified Route Handler passing `auth.userId`).
 *
 * NEVER re-export this function (or a thin pass-through wrapper around it) as
 * a `"use server"` Server Action, and never let a `"use server"` action accept
 * a caller-supplied `userId`/`ownerId`/`actorId` and forward it here. Every
 * exported function in a `"use server"` file is a public POST endpoint
 * reachable by any client that knows the action id — an unauthenticated
 * caller could forge `usage_events` rows for any user, which is exactly the
 * vulnerability E346 closed (see docs/epics/e346-record-usage-auth-gap.md).
 *
 * `actions/usage.ts`'s `recordUsage` is the safe, session-authenticated
 * public wrapper: it resolves the signed-in user's own id via `requireAuth()`
 * first, then delegates to this function. It does not accept a `userId` param.
 */

import { db } from "@/lib/db"
import { usageEventsTable } from "@/lib/schema"

export interface RecordUsageResult {
  success: boolean
  error?: string
}

/**
 * Append one usage event for `userId`. Purely a data-layer write — the caller
 * is responsible for having authorized `userId`.
 *
 * @param userId - The already-authorized owning user id. NOT re-validated here.
 * @param metric - The metered event name, e.g. "api_request".
 * @param delta - Units this event counts for (default 1).
 */
export async function recordUsageFor(
  userId: string,
  metric: string,
  delta = 1,
): Promise<RecordUsageResult> {
  const trimmedMetric = metric?.trim()
  if (!trimmedMetric) {
    return { success: false, error: "metric is required" }
  }
  if (!Number.isFinite(delta)) {
    return { success: false, error: "delta must be a finite number" }
  }

  try {
    await db.insert(usageEventsTable).values({
      userId,
      metric: trimmedMetric,
      delta,
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return { success: false, error: message }
  }
}
