/**
 * Usage metering — pure, db-free helpers (E301, E308).
 *
 * The metering FOUNDATION, not a pricing model: these functions compute the
 * period window, format usage and resolve plan caps so the DB layer
 * (lib/db/queries/usage.ts), the Server Action (actions/usage.ts) and the billing
 * panel stay thin. Everything here is pure and synchronous so it can be unit-tested
 * without a database — see usage-utils.test.ts. (The current-month total itself is
 * summed in Postgres by getCurrentMonthUsage, which is cheaper than loading every
 * row into Node.)
 *
 * E308 adds the limit layer: `getPlanLimit` reads a tier's per-metric cap from
 * `config/pricing.json` (via lib/billing/pricing — JSON-only, no db import) and
 * `assertWithinLimit` is the pure overage decision the API route can opt into.
 */

import { getTierBySlug, type PricingTier } from "@/lib/billing/pricing"

/** A half-open usage window [start, end) — typically the current calendar month. */
export interface UsagePeriod {
  start: Date
  end: Date
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

// ---------------------------------------------------------------------------
// Plan limits (E308) — pure, db-free. Caps live in config/pricing.json.
// ---------------------------------------------------------------------------

/**
 * Resolve a plan's monthly cap for a metric.
 *
 * `plan` is a tier slug ("free" / "pro" / "scale" / …). A `PricingTier` may also
 * be passed directly. The cap comes from the tier's `limits` map in
 * `config/pricing.json`. The convention is UNLIMITED-by-default:
 *
 *   - unknown tier slug              → null (unlimited)
 *   - tier with no `limits` key      → null (unlimited)  e.g. the Scale tier
 *   - metric absent from `limits`    → null (unlimited)
 *   - a non-finite / negative value  → null (treat as unlimited, defensive)
 *   - otherwise                      → the finite cap (0 is a valid hard cap)
 *
 * Returns `number | null` — null is the sentinel `formatUsageDisplay` already
 * renders as "{current} / ∞" with no Progress bar.
 */
export function getPlanLimit(plan: string | PricingTier, metric: string): number | null {
  const tier: PricingTier | undefined =
    typeof plan === "string" ? getTierBySlug(plan) : plan
  const raw = tier?.limits?.[metric]
  if (raw === undefined || raw === null) return null
  if (!Number.isFinite(raw) || raw < 0) return null
  return raw
}

/** The decision returned by `assertWithinLimit` — pure, so the caller owns the I/O. */
export interface LimitCheck {
  /** True when the request is allowed (under the cap, or the cap is unlimited). */
  allowed: boolean
  /** The resolved cap, or null when unlimited. */
  limit: number | null
  /** Usage AFTER this request would be counted (current + delta). */
  projected: number
  /** Human-readable reason when `allowed` is false (else null). */
  reason: string | null
}

/**
 * Pure overage check: would consuming `delta` more units of `metric` keep the
 * plan within its cap? This makes NO db call and performs NO enforcement — it
 * only returns the decision. The caller (e.g. a route handler) decides whether
 * to 429. Unlimited plans (null cap) always allow.
 *
 * A request is allowed iff `current + delta <= limit`. (current already at the
 * cap with delta 0 is still allowed; one more unit over is not.)
 */
export function assertWithinLimit(
  plan: string | PricingTier,
  metric: string,
  current: number,
  delta = 1,
): LimitCheck {
  const limit = getPlanLimit(plan, metric)
  const safeCurrent = Number.isFinite(current) ? Math.max(0, current) : 0
  const safeDelta = Number.isFinite(delta) ? delta : 0
  const projected = safeCurrent + safeDelta

  if (limit === null) {
    return { allowed: true, limit: null, projected, reason: null }
  }

  const allowed = projected <= limit
  return {
    allowed,
    limit,
    projected,
    reason: allowed
      ? null
      : `Usage limit reached for "${metric}": ${projected} would exceed the plan cap of ${limit}.`,
  }
}
