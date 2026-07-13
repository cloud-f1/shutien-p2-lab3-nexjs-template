/**
 * Conversion-funnel data access — E334 (the ONLY module that reads/writes the
 * funnel tables). Pure math + row folding lives in `funnel-utils.ts`; this file
 * just runs GROUP BY queries and hands the raw counts to those pure functions,
 * so the aggregation logic stays unit-testable without a database.
 *
 * ── RETENTION ──────────────────────────────────────────────────────────────
 * `sales_page_events` rows are disposable telemetry — keep {@link EVENT_RETENTION_DAYS}
 * days, then delete. Wire ONE of these up per deployment:
 *
 *   1. Cron / scheduler (preferred): call `deleteExpiredSalesPageEvents()` daily.
 *      With the in-process @saas/scheduler module, add it to lib/scheduler-job.ts.
 *   2. Manual SQL (equivalent), e.g. a psql cron on the host:
 *        DELETE FROM sales_page_events WHERE created_at < now() - interval '90 days';
 *
 * The permanent conversion signal lives in `orders` and is NEVER pruned.
 */

import { and, countDistinct, count, eq, gte, lt, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { ordersTable, salesPageEventsTable, salesPagesTable } from "@/lib/schema"
import {
  aggregateChannelRows,
  aggregateFunnelRows,
  EVENT_RETENTION_DAYS,
  normalizeUtm,
  type ChannelEventCountRow,
  type ChannelPaidCountRow,
  type EventCountRow,
  type FunnelReport,
  type FunnelRowWithChannels,
  type PaidCountRow,
} from "@/lib/analytics/funnel-utils"

export { EVENT_RETENTION_DAYS }
export type { FunnelReport, FunnelRowWithChannels }

/**
 * Record a single funnel event (server-side; called by the collect route). The
 * session hash is computed by the caller from request headers — never trusted
 * from the client. Entirely best-effort: a write failure is swallowed so
 * telemetry can NEVER affect the page or the checkout it is measuring.
 */
export async function recordSalesPageEvent(input: {
  slug: string
  event: "page_view" | "cta_click" | "checkout_started"
  sessionHash: string
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null } | null
}): Promise<void> {
  const utm = normalizeUtm(input.utm ?? null)
  try {
    await db.insert(salesPageEventsTable).values({
      slug: input.slug,
      event: input.event,
      sessionHash: input.sessionHash,
      utmSource: utm.source,
      utmMedium: utm.medium,
      utmCampaign: utm.campaign,
    })
  } catch {
    // Best-effort telemetry — never surface a DB error to the visitor.
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Aggregate the sales-page funnel over the trailing `windowDays` days: for every
 * slug that saw traffic, the four layers (page_view → cta_click → checkout_started
 * → paid) as absolute counts + derived rates, each with a per-UTM-channel
 * breakdown. Unique sessions (not raw hits) are counted for the event layers, so
 * a refresh-happy visitor is one view. "Paid" joins `orders` to the linked sales
 * page via product (E327). Admin-only — the caller gates (requireAdmin).
 */
export async function getSalesPageFunnels(windowDays: number): Promise<FunnelReport> {
  const since = new Date(Date.now() - windowDays * DAY_MS)

  // jsonb text extraction for the per-channel paid grouping (reused in select+groupBy).
  const paidSource = sql<string | null>`${ordersTable.utm}->>'source'`
  const paidMedium = sql<string | null>`${ordersTable.utm}->>'medium'`
  const paidCampaign = sql<string | null>`${ordersTable.utm}->>'campaign'`

  const [eventRowsRaw, paidRowsRaw, channelEventRowsRaw, channelPaidRowsRaw] = await Promise.all([
    // Layer counts per (slug, event) — distinct sessions.
    db
      .select({
        slug: salesPageEventsTable.slug,
        event: salesPageEventsTable.event,
        count: countDistinct(salesPageEventsTable.sessionHash),
      })
      .from(salesPageEventsTable)
      .where(gte(salesPageEventsTable.createdAt, since))
      .groupBy(salesPageEventsTable.slug, salesPageEventsTable.event),
    // Paid orders per slug — order → linked sales page via product.
    db
      .select({ slug: salesPagesTable.slug, count: count() })
      .from(ordersTable)
      .innerJoin(salesPagesTable, eq(salesPagesTable.productId, ordersTable.productId))
      .where(and(eq(ordersTable.status, "paid"), gte(ordersTable.createdAt, since)))
      .groupBy(salesPagesTable.slug),
    // Per-channel layer counts per (slug, utm, event).
    db
      .select({
        slug: salesPageEventsTable.slug,
        event: salesPageEventsTable.event,
        source: salesPageEventsTable.utmSource,
        medium: salesPageEventsTable.utmMedium,
        campaign: salesPageEventsTable.utmCampaign,
        count: countDistinct(salesPageEventsTable.sessionHash),
      })
      .from(salesPageEventsTable)
      .where(gte(salesPageEventsTable.createdAt, since))
      .groupBy(
        salesPageEventsTable.slug,
        salesPageEventsTable.event,
        salesPageEventsTable.utmSource,
        salesPageEventsTable.utmMedium,
        salesPageEventsTable.utmCampaign,
      ),
    // Per-channel paid orders per (slug, utm).
    db
      .select({
        slug: salesPagesTable.slug,
        source: paidSource,
        medium: paidMedium,
        campaign: paidCampaign,
        count: count(),
      })
      .from(ordersTable)
      .innerJoin(salesPagesTable, eq(salesPagesTable.productId, ordersTable.productId))
      .where(and(eq(ordersTable.status, "paid"), gte(ordersTable.createdAt, since)))
      .groupBy(salesPagesTable.slug, paidSource, paidMedium, paidCampaign),
  ])

  const eventRows: EventCountRow[] = eventRowsRaw.map((r) => ({
    slug: r.slug,
    event: r.event,
    count: Number(r.count),
  }))
  const paidRows: PaidCountRow[] = paidRowsRaw.map((r) => ({
    slug: r.slug,
    count: Number(r.count),
  }))
  const channelEventRows: ChannelEventCountRow[] = channelEventRowsRaw.map((r) => ({
    slug: r.slug,
    event: r.event,
    count: Number(r.count),
    utm: normalizeUtm({ source: r.source, medium: r.medium, campaign: r.campaign }),
  }))
  const channelPaidRows: ChannelPaidCountRow[] = channelPaidRowsRaw.map((r) => ({
    slug: r.slug,
    count: Number(r.count),
    utm: normalizeUtm({ source: r.source, medium: r.medium, campaign: r.campaign }),
  }))

  const rows: FunnelRowWithChannels[] = aggregateFunnelRows(eventRows, paidRows).map((row) => ({
    ...row,
    channels: aggregateChannelRows(row.slug, channelEventRows, channelPaidRows),
  }))

  return { windowDays, rows }
}

/**
 * Retention sweep — delete `sales_page_events` older than {@link EVENT_RETENTION_DAYS}.
 * Idempotent and safe to run repeatedly (a no-op once nothing is stale). Returns
 * the number of rows deleted. Wire to a daily cron/scheduler (see module header).
 */
export async function deleteExpiredSalesPageEvents(
  retentionDays: number = EVENT_RETENTION_DAYS,
): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * DAY_MS)
  const result = await db.delete(salesPageEventsTable).where(lt(salesPageEventsTable.createdAt, cutoff))
  return (result as { count?: number }).count ?? 0
}
