/**
 * Conversion-funnel PURE logic — E334.
 *
 * Isomorphic + dependency-free (NO `@/lib/db`, NO node built-ins) so it can be
 * imported from both the browser beacon (`lib/analytics/beacon.ts`) and the
 * server aggregation (`lib/analytics/funnel.ts`), AND unit-tested directly (it is
 * in vitest's coverage `include`). All rate math + row aggregation lives here so
 * the db module only runs GROUP BY queries and hands raw count rows to these
 * functions.
 */

/**
 * The three funnel events — the SINGLE SOURCE OF TRUTH for both the DB enum
 * (`lib/schema/analytics.ts` imports these) and the browser beacon. Declared
 * here (not in the schema) so this pure module stays free of any `drizzle-orm`
 * import and can be safely bundled into client code.
 */
export const SALES_PAGE_EVENTS = ["page_view", "cta_click", "checkout_started"] as const
export type SalesPageEventName = (typeof SALES_PAGE_EVENTS)[number]

/** Days a `sales_page_events` row is retained before the cleanup sweep drops it. */
export const EVENT_RETENTION_DAYS = 90

/** Label shown for a channel with no `utm_source` (organic / typed-in traffic). */
export const DIRECT_CHANNEL_LABEL = "(直接流量)"

/** First-party UTM tags. Every field nullable — direct/organic traffic has none. */
export interface UtmParams {
  source: string | null
  medium: string | null
  campaign: string | null
}

const EMPTY_UTM: UtmParams = { source: null, medium: null, campaign: null }

/** Max stored length per UTM field — guards the column + keeps channel keys sane. */
const UTM_MAX_LEN = 200

function cleanUtmValue(v: unknown): string | null {
  if (typeof v !== "string") return null
  const trimmed = v.trim().slice(0, UTM_MAX_LEN)
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Normalize a raw UTM bag (URLSearchParams entries, a JSON body, a DB row…) into
 * the canonical {@link UtmParams}. Accepts both the short (`source`) and prefixed
 * (`utm_source`) key spellings. Empty/whitespace/non-string → null.
 */
export function normalizeUtm(raw: Record<string, unknown> | null | undefined): UtmParams {
  if (!raw) return { ...EMPTY_UTM }
  return {
    source: cleanUtmValue(raw.source ?? raw.utm_source),
    medium: cleanUtmValue(raw.medium ?? raw.utm_medium),
    campaign: cleanUtmValue(raw.campaign ?? raw.utm_campaign),
  }
}

/** True when a UTM bag carries no first-party tag at all (pure direct traffic). */
export function isEmptyUtm(utm: UtmParams): boolean {
  return utm.source === null && utm.medium === null && utm.campaign === null
}

/** Stable grouping key for a channel — used to bucket rows by (source, medium, campaign). */
export function channelKey(utm: UtmParams): string {
  return `${utm.source ?? ""}|${utm.medium ?? ""}|${utm.campaign ?? ""}`
}

/** Human label for a channel row (falls back to a "direct" label when untagged). */
export function channelLabel(utm: UtmParams): string {
  if (isEmptyUtm(utm)) return DIRECT_CHANNEL_LABEL
  const parts = [utm.source, utm.medium, utm.campaign].filter(Boolean)
  return parts.join(" / ")
}

/** A conversion rate in [0,1]; 0 when the denominator is 0 (avoids NaN/∞). */
export function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  const r = numerator / denominator
  return r < 0 ? 0 : r > 1 ? 1 : r
}

/** Absolute funnel counts for one row (a page, or one channel within a page). */
export interface FunnelCounts {
  views: number
  ctaClicks: number
  checkoutStarted: number
  paid: number
}

/** Counts + derived rates for one funnel row. */
export interface FunnelStats extends FunnelCounts {
  /** cta_click / page_view. */
  ctaRate: number
  /** checkout_started / cta_click. */
  checkoutRate: number
  /** paid / checkout_started. */
  paymentRate: number
  /** paid / page_view — the end-to-end conversion. */
  overallRate: number
}

/** Attach the four derived rates to a bag of absolute counts. */
export function computeStats(counts: FunnelCounts): FunnelStats {
  return {
    ...counts,
    ctaRate: rate(counts.ctaClicks, counts.views),
    checkoutRate: rate(counts.checkoutStarted, counts.ctaClicks),
    paymentRate: rate(counts.paid, counts.checkoutStarted),
    overallRate: rate(counts.paid, counts.views),
  }
}

/** One (slug, event) → count row as returned by the events GROUP BY query. */
export interface EventCountRow {
  slug: string
  event: SalesPageEventName
  count: number
}

/** One (slug) → paid-order count row as returned by the orders GROUP BY query. */
export interface PaidCountRow {
  slug: string
  count: number
}

const EMPTY_COUNTS: FunnelCounts = { views: 0, ctaClicks: 0, checkoutStarted: 0, paid: 0 }

function applyEvent(counts: FunnelCounts, event: SalesPageEventName, n: number): void {
  if (event === "page_view") counts.views += n
  else if (event === "cta_click") counts.ctaClicks += n
  else if (event === "checkout_started") counts.checkoutStarted += n
}

/** A whole-page funnel row: the slug + its stats. */
export interface FunnelRow extends FunnelStats {
  slug: string
}

/**
 * Fold raw event counts + paid-order counts into one {@link FunnelRow} per slug,
 * sorted by page_view desc (busiest page first). A slug that appears only in the
 * paid rows (events pruned/absent) still surfaces so revenue is never hidden.
 */
export function aggregateFunnelRows(
  eventRows: EventCountRow[],
  paidRows: PaidCountRow[],
): FunnelRow[] {
  const bySlug = new Map<string, FunnelCounts>()
  const ensure = (slug: string): FunnelCounts => {
    let c = bySlug.get(slug)
    if (!c) {
      c = { ...EMPTY_COUNTS }
      bySlug.set(slug, c)
    }
    return c
  }

  for (const r of eventRows) applyEvent(ensure(r.slug), r.event, r.count)
  for (const r of paidRows) ensure(r.slug).paid += r.count

  return Array.from(bySlug.entries())
    .map(([slug, counts]) => ({ slug, ...computeStats(counts) }))
    .sort((a, b) => b.views - a.views || b.paid - a.paid || a.slug.localeCompare(b.slug))
}

/** One (slug, channel, event) → count row from the per-channel events query. */
export interface ChannelEventCountRow extends EventCountRow {
  utm: UtmParams
}

/** One (slug, channel) → paid count row from the per-channel orders query. */
export interface ChannelPaidCountRow extends PaidCountRow {
  utm: UtmParams
}

/** One channel breakdown row within a page. */
export interface ChannelRow extends FunnelStats {
  key: string
  label: string
  utm: UtmParams
}

/** A whole-page funnel row plus its per-channel (UTM) breakdown. */
export interface FunnelRowWithChannels extends FunnelRow {
  channels: ChannelRow[]
}

/** A funnel report over a trailing time window. */
export interface FunnelReport {
  windowDays: number
  rows: FunnelRowWithChannels[]
}

/**
 * Build the per-channel breakdown for a SINGLE slug, sorted by page_view desc.
 * Pure — the db module filters the raw rows to one slug before calling this (or
 * passes all rows; rows for other slugs are simply ignored via the slug guard).
 */
export function aggregateChannelRows(
  slug: string,
  eventRows: ChannelEventCountRow[],
  paidRows: ChannelPaidCountRow[],
): ChannelRow[] {
  const byChannel = new Map<string, { utm: UtmParams; counts: FunnelCounts }>()
  const ensure = (utm: UtmParams): FunnelCounts => {
    const key = channelKey(utm)
    let entry = byChannel.get(key)
    if (!entry) {
      entry = { utm, counts: { ...EMPTY_COUNTS } }
      byChannel.set(key, entry)
    }
    return entry.counts
  }

  for (const r of eventRows) {
    if (r.slug !== slug) continue
    applyEvent(ensure(r.utm), r.event, r.count)
  }
  for (const r of paidRows) {
    if (r.slug !== slug) continue
    ensure(r.utm).paid += r.count
  }

  return Array.from(byChannel.entries())
    .map(([key, { utm, counts }]) => ({
      key,
      label: channelLabel(utm),
      utm,
      ...computeStats(counts),
    }))
    .sort((a, b) => b.views - a.views || b.paid - a.paid || a.label.localeCompare(b.label))
}
