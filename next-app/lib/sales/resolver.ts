import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { productsTable, salesPagesTable } from "@/lib/schema"
import { getConfigSalesPageContent, getConfigSalesPageSlugs, salesPageContentSchema, type SalesPageContent } from "@/lib/sales/content"
import { getCustomSalesSlugs, type SalesPageProduct } from "@/lib/sales/custom-pages"
import { verifyPreviewToken } from "@/lib/sales/preview-token"
import { canServeSalesPageRow } from "@/lib/sales/visibility"

/**
 * DB-first sales-page content resolver (E332).
 *
 * The `/p/[slug]` route reads content ONLY through this function. Resolution
 * order for a slug:
 *   1. `sales_pages` row → served when {@link canServeSalesPageRow} allows
 *      (published, or draft with a valid preview token; `custom` rows are
 *      skipped for E333). Content is re-validated through the same
 *      `salesPageContentSchema` on the way out (defence in depth).
 *   2. No row → fall back to the E326 static config (`getConfigSalesPageContent`)
 *      so every pre-seed / pre-existing page keeps working unchanged.
 *
 * A slug that has a `sales_pages` row which is NOT servable (draft w/o token, or
 * custom) resolves to `undefined` — it does NOT fall through to a same-named
 * config page (an explicit draft/custom row intentionally hides the slug).
 */
export async function getSalesPageContent(
  slug: string,
  opts?: { previewToken?: string | null },
): Promise<SalesPageContent | undefined> {
  let row:
    | { content: SalesPageContent; status: "draft" | "published"; renderMode: "structured" | "custom" }
    | undefined
  try {
    ;[row] = await db
      .select({
        content: salesPagesTable.content,
        status: salesPagesTable.status,
        renderMode: salesPagesTable.renderMode,
      })
      .from(salesPagesTable)
      .where(eq(salesPagesTable.slug, slug))
      .limit(1)
  } catch {
    // DB unreachable (e.g. build-time prerender with no DB) — degrade to config
    // so pre-existing config pages still render instead of 500-ing.
    return getConfigSalesPageContent(slug)
  }

  if (row) {
    const hasValidPreview =
      row.status === "draft" ? verifyPreviewToken(slug, opts?.previewToken) : false
    if (!canServeSalesPageRow(row, hasValidPreview)) return undefined
    // Re-validate on read — a hand-edited row can't render malformed content.
    return salesPageContentSchema.parse(row.content)
  }

  return getConfigSalesPageContent(slug)
}

/**
 * Union of slugs to pre-render — published+structured DB rows, every static
 * config slug, and every E333 custom-registry slug. Feeds `generateStaticParams`.
 * If the DB is unreachable at build time (e.g. a CI build with no Postgres), fall
 * back to config + custom slugs (both are code-derived, so always available);
 * `dynamicParams` keeps unknown slugs renderable on demand via ISR.
 */
export async function getAllSalesPageSlugs(): Promise<string[]> {
  const codeSlugs = [...getConfigSalesPageSlugs(), ...getCustomSalesSlugs()]
  try {
    const rows = await db
      .select({ slug: salesPagesTable.slug })
      .from(salesPagesTable)
      .where(
        and(eq(salesPagesTable.status, "published"), eq(salesPagesTable.renderMode, "structured")),
      )
    const dbSlugs = rows.map((r) => r.slug)
    return Array.from(new Set([...dbSlugs, ...codeSlugs]))
  } catch {
    return Array.from(new Set(codeSlugs))
  }
}

/**
 * Resolve the E327 product linked to a sales-page slug (via `sales_pages.product_id`)
 * — the checkout binding a custom page (E333) needs to display price and drive
 * `createOneTimeCheckout`. Returns `null` when the slug has no row, no linked
 * product, the product is inactive, or the DB is unreachable — callers must
 * degrade gracefully (price/CTA disabled). Only the server-owned fields are
 * selected; a custom page never sees or trusts anything else.
 */
export async function getSalesPageProduct(slug: string): Promise<SalesPageProduct | null> {
  try {
    const [row] = await db
      .select({
        slug: productsTable.slug,
        name: productsTable.name,
        description: productsTable.description,
        amount: productsTable.amount,
        currency: productsTable.currency,
      })
      .from(salesPagesTable)
      .innerJoin(productsTable, eq(salesPagesTable.productId, productsTable.id))
      .where(and(eq(salesPagesTable.slug, slug), eq(productsTable.active, true)))
      .limit(1)
    return row ?? null
  } catch {
    return null
  }
}
