/**
 * Pure period-end parsing helpers (E274) — NO db / SDK import, unit-testable
 * WITHOUT a DATABASE_URL.
 *
 * Stripe SDK v22+ (API 2026-05-27.dahlia) moved `current_period_end` OFF the
 * top-level Subscription onto each SubscriptionItem
 * (`subscription.items.data[i].current_period_end`). These helpers read the
 * epoch from whichever shape is present and convert it to a JS Date for the
 * `subscriptions.current_period_end` timestamp column.
 *
 * ECPay 定期定額 has no period-end field; we derive the NEXT charge date from the
 * period type + frequency relative to a base date.
 */

// ---------------------------------------------------------------------------
// Stripe — extract current_period_end epoch (seconds) from a Subscription
// ---------------------------------------------------------------------------

/** Minimal structural shape of the bits of a Stripe Subscription we read. */
export interface StripeSubLike {
  current_period_end?: number | null
  items?: {
    data?: Array<{ current_period_end?: number | null }>
  } | null
}

/**
 * Extract the current-period-end epoch (unix seconds) from a Stripe subscription
 * object, tolerant of both the legacy top-level field and the v22+ per-item field.
 * Returns the MAX across items (the furthest-out renewal) or null if absent.
 */
export function stripePeriodEndEpoch(sub: StripeSubLike | null | undefined): number | null {
  if (!sub) return null

  // Legacy top-level (older API versions / fixtures)
  if (typeof sub.current_period_end === "number" && sub.current_period_end > 0) {
    return sub.current_period_end
  }

  // v22+: per subscription item
  const items = sub.items?.data ?? []
  let max: number | null = null
  for (const item of items) {
    const e = item?.current_period_end
    if (typeof e === "number" && e > 0) {
      max = max === null ? e : Math.max(max, e)
    }
  }
  return max
}

/** Convert a unix-seconds epoch to a Date, or null if not a positive number. */
export function epochToDate(epoch: number | null | undefined): Date | null {
  if (typeof epoch !== "number" || !Number.isFinite(epoch) || epoch <= 0) return null
  return new Date(epoch * 1000)
}

/**
 * Stripe convenience: subscription object → Date for the DB column (or null).
 */
export function stripePeriodEndDate(sub: StripeSubLike | null | undefined): Date | null {
  return epochToDate(stripePeriodEndEpoch(sub))
}

// ---------------------------------------------------------------------------
// ECPay — derive the next charge date from period type + frequency
// ---------------------------------------------------------------------------

/** ECPay PeriodType → ms/period step applied `frequency` times from `from`. */
export type EcpayPeriodType = "D" | "M" | "Y"

/**
 * Compute the NEXT charge date for an ECPay 定期定額 subscription.
 *
 * @param from       base date (the last successful charge, or now)
 * @param periodType "D" | "M" | "Y"
 * @param frequency  cycles per period step (ECPay `Frequency`, default 1)
 */
export function ecpayNextChargeDate(
  from: Date,
  periodType: EcpayPeriodType,
  frequency = 1,
): Date {
  const d = new Date(from.getTime())
  const n = Number.isFinite(frequency) && frequency > 0 ? Math.floor(frequency) : 1
  switch (periodType) {
    case "D":
      d.setDate(d.getDate() + n)
      break
    case "Y":
      d.setFullYear(d.getFullYear() + n)
      break
    case "M":
    default:
      d.setMonth(d.getMonth() + n)
      break
  }
  return d
}

/**
 * Resolve the current-period-end Date for an ECPay subscription from its
 * provider_meta. Prefers an explicit `current_period_end` epoch when present,
 * else derives next-charge from `last_period_at` (or `from`) + period_type.
 */
export function ecpayPeriodEndDate(
  meta: Record<string, unknown> | null | undefined,
  from: Date = new Date(),
): Date | null {
  const m = meta ?? {}

  const explicit = m["current_period_end"]
  if (typeof explicit === "number" && explicit > 0) {
    return epochToDate(explicit)
  }

  const periodType = (typeof m["period_type"] === "string" ? m["period_type"] : "M") as EcpayPeriodType
  const frequency = typeof m["frequency"] === "number" ? (m["frequency"] as number) : 1

  const lastAtRaw = m["last_period_at"]
  let base = from
  if (typeof lastAtRaw === "string") {
    const parsed = new Date(lastAtRaw)
    if (!Number.isNaN(parsed.getTime())) base = parsed
  }

  return ecpayNextChargeDate(base, periodType, frequency)
}
