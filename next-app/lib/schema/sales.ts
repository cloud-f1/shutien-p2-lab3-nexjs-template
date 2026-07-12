import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import type { SalesPageContent } from "@/lib/sales/content"

import { productsTable } from "./billing"

// ---------------------------------------------------------------------------
// DB-backed sales pages — E332 (admin CRUD + ISR)
// ---------------------------------------------------------------------------

/**
 * Publication lifecycle for a DB-backed sales page. A page is created `draft`
 * (invisible to the public unless a signed preview token is presented) and
 * `published` exactly once operations are ready; unpublishing flips it back.
 */
export const SALES_PAGE_STATUSES = ["draft", "published"] as const
export type SalesPageStatus = (typeof SALES_PAGE_STATUSES)[number]
export const salesPageStatusEnum = pgEnum("sales_page_status", SALES_PAGE_STATUSES)

/**
 * Render mode. `structured` (default) renders the E326 section pipeline from the
 * `content` JSONB. `custom` marks a slug as owned by the E333 custom-page
 * registry — this table then only tracks metadata/status and the structured
 * renderer skips it (returns undefined → route 404s until the registry claims it).
 */
export const SALES_PAGE_RENDER_MODES = ["structured", "custom"] as const
export type SalesPageRenderMode = (typeof SALES_PAGE_RENDER_MODES)[number]
export const salesPageRenderModeEnum = pgEnum("sales_page_render_mode", SALES_PAGE_RENDER_MODES)

/**
 * sales_pages — one row per admin-authored one-page sales site.
 *
 * `content` stores the E326 `SalesPageContent` contract as JSONB and is
 * validated by the SAME `salesPageContentSchema` Zod schema on every write
 * (single contract, no drift — bad payloads can't reach the column). `product_id`
 * links the page to the E327 SKU whose checkout its CTAs drive (nullable +
 * `set null` so deleting a product never orphans/deletes the page).
 */
export const salesPagesTable = pgTable(
  "sales_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** URL-safe unique identifier — the `/p/[slug]` route segment. */
    slug: text("slug").notNull().unique(),
    /** Linked one-time product (E327). Nullable — a page can exist pre-product. */
    productId: uuid("product_id").references(() => productsTable.id, { onDelete: "set null" }),
    /** The full E326 content contract, validated by salesPageContentSchema on write. */
    content: jsonb("content").$type<SalesPageContent>().notNull(),
    renderMode: salesPageRenderModeEnum("render_mode").notNull().default("structured"),
    status: salesPageStatusEnum("status").notNull().default("draft"),
    /** Set the first time the page transitions to `published`; cleared on unpublish. */
    publishedAt: timestamp("published_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("sales_pages_status_idx").on(t.status),
    index("sales_pages_product_id_idx").on(t.productId),
  ],
)

export type SalesPage = typeof salesPagesTable.$inferSelect
export type NewSalesPage = typeof salesPagesTable.$inferInsert
