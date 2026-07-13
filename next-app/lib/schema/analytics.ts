import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { SALES_PAGE_EVENTS, type SalesPageEventName } from "@/lib/analytics/funnel-utils"

// ---------------------------------------------------------------------------
// Sales-page conversion funnel — E334 (first-party analytics, no PII)
// ---------------------------------------------------------------------------

/**
 * The three funnel events collected from a sales page (source of truth:
 * `lib/analytics/funnel-utils.ts`, kept drizzle-free so the browser beacon can
 * share it). "Payment" is NOT an event here — a paid `orders` row (E327) is the
 * funnel's final layer, so this table stays strictly pre-purchase and bounded.
 */
export { SALES_PAGE_EVENTS, type SalesPageEventName }
export const salesPageEventEnum = pgEnum("sales_page_event", SALES_PAGE_EVENTS)

/**
 * sales_page_events — high-volume, append-only funnel log for `/p/[slug]` pages.
 *
 * PRIVACY (a hard requirement of this epic — see E334 acceptance):
 *   - NO IP or User-Agent is ever stored. `session_hash` is a one-way, DAY-SCOPED
 *     HMAC (see lib/analytics/session-hash.ts) that lets aggregation count unique
 *     sessions WITHOUT retaining anything that identifies a person; it rotates
 *     every calendar day and is not reversible.
 *   - NO cross-site cookie is set (the beacon is same-origin, credential-less).
 *   - UTM values are first-party marketing tags the visitor's own link carried;
 *     they are nullable (organic/direct traffic has none).
 *
 * RETENTION: rows are disposable — keep 90 days, then delete (see
 * lib/analytics/funnel.ts → deleteExpiredSalesPageEvents / EVENT_RETENTION_DAYS).
 * The permanent conversion signal lives in `orders`, which is never pruned.
 */
export const salesPageEventsTable = pgTable(
  "sales_page_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The `/p/[slug]` the event was collected on (not FK'd — config + custom + DB pages all report). */
    slug: text("slug").notNull(),
    event: salesPageEventEnum("event").notNull(),
    /** First-party UTM tags off the landing URL. Nullable — direct traffic has none. */
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    /** Day-scoped anonymous session HMAC — NOT an IP/UA, not reversible, rotates daily. */
    sessionHash: text("session_hash").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    // Aggregation reads by slug within a rolling time window, grouped by event.
    index("sales_page_events_slug_created_idx").on(t.slug, t.createdAt),
    index("sales_page_events_slug_event_idx").on(t.slug, t.event),
    // Retention sweep deletes by age.
    index("sales_page_events_created_idx").on(t.createdAt),
  ],
)

export type SalesPageEvent = typeof salesPageEventsTable.$inferSelect
export type NewSalesPageEvent = typeof salesPageEventsTable.$inferInsert
