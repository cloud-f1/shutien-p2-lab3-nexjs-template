import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { salesPagesTable } from "@/lib/schema/sales"
import { getConfigSalesPageContent, getConfigSalesPageSlugs, salesPageContentSchema, type SalesPageContent } from "@/lib/sales/content"
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
 * Union of slugs to pre-render — published+structured DB rows plus every static
 * config slug. Feeds `generateStaticParams`. If the DB is unreachable at build
 * time (e.g. a CI build with no Postgres), fall back to config slugs only;
 * `dynamicParams` keeps unknown slugs renderable on demand via ISR.
 */
export async function getAllSalesPageSlugs(): Promise<string[]> {
  const configSlugs = getConfigSalesPageSlugs()
  try {
    const rows = await db
      .select({ slug: salesPagesTable.slug })
      .from(salesPagesTable)
      .where(
        and(eq(salesPagesTable.status, "published"), eq(salesPagesTable.renderMode, "structured")),
      )
    const dbSlugs = rows.map((r) => r.slug)
    return Array.from(new Set([...dbSlugs, ...configSlugs]))
  } catch {
    return configSlugs
  }
}
