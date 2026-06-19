/**
 * Usage metering — pure, db-free helpers (E301).
 *
 * The metering FOUNDATION, not a pricing model: these functions aggregate and
 * format usage so the DB layer (lib/db/queries/usage.ts), the Server Action
 * (actions/usage.ts) and the billing panel stay thin. Everything here is pure
 * and synchronous so it can be unit-tested without a database — see
 * usage-utils.test.ts.
 */

/** The minimal shape an event needs to be aggregated — matches usageEventsTable rows. */
export interface UsageEventLike {
  metric: string
  delta: number
}

/** A half-open usage window [start, end) — typically the current calendar month. */
export interface UsagePeriod {
  start: Date
  end: Date
}

/**
 * Sum `delta` across the events that match `metric`. Rows for other metrics are
 * ignored, so a single mixed-metric result set can be reduced per metric. A
 * non-finite or missing delta contributes 0 (defensive — DB default is 1).
 */
export function aggregateUsage(events: readonly UsageEventLike[], metric: string): number {
  let total = 0
  for (const event of events) {
    if (event.metric !== metric) continue
    const delta = Number(event.delta)
    if (Number.isFinite(delta)) total += delta
  }
  return total
}

/**
 * The current calendar-month window in UTC as a half-open interval [start, end):
 * start = first instant of this month, end = first instant of next month. Using
 * UTC keeps the boundary deterministic regardless of server timezone, and the
 * half-open shape means a `createdAt >= start AND createdAt < end` filter has no
 * gaps or double-counts at the boundary.
 */
export function getUsagePeriod(now: Date = new Date()): UsagePeriod {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0))
  return { start, end }
}

/** Rendered usage with everything the panel needs to draw the meter. */
export interface UsageDisplay {
  /** "{current} / {limit}" — or "{current} / ∞" when the limit is unlimited. */
  label: string
  /** Whether a finite limit exists (drives whether a Progress bar is shown). */
  hasLimit: boolean
  /** 0–100 fill percent (clamped). 0 when there is no finite limit. */
  percent: number
}

const UNLIMITED = "∞"

/**
 * Format a usage reading against an optional limit.
 *
 * - `limit === null` (or non-finite) → unlimited: "{current} / ∞", no bar.
 * - `limit === 0` → there is a (zero) cap: "{current} / 0", bar at 100%.
 * - otherwise → "{current} / {limit}" with the fill percent clamped to [0, 100].
 */
export function formatUsageDisplay(current: number, limit: number | null): UsageDisplay {
  const safeCurrent = Number.isFinite(current) ? Math.max(0, current) : 0

  if (limit === null || !Number.isFinite(limit)) {
    return { label: `${safeCurrent} / ${UNLIMITED}`, hasLimit: false, percent: 0 }
  }

  const safeLimit = Math.max(0, limit)
  const percent =
    safeLimit === 0 ? 100 : Math.min(100, Math.round((safeCurrent / safeLimit) * 100))

  return { label: `${safeCurrent} / ${safeLimit}`, hasLimit: true, percent }
}
