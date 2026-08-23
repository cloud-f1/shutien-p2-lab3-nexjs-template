/**
 * Sales-page admin queries — internal read path (E350).
 *
 * TRUST BOUNDARY: `listSalesPages` performs NO authentication or authorization
 * check of its own. It trusts the caller to already be an authorized context —
 * a Server Component that has called `requireAdmin()` (or equivalent), or a
 * Route Handler that has done the same. It returns every sales page including
 * `status` and the full `content` JSONB, which is exactly what makes it
 * dangerous to expose unguarded: drafts and unpublished marketing content
 * (pricing experiments, unreleased positioning, unpublished copy) would be
 * readable by anyone who could reach it.
 *
 * NEVER re-export this function (or a thin pass-through wrapper around it)
 * from a `"use server"` file. Every exported function in a `"use server"`
 * file is a public POST endpoint reachable by any client that knows the
 * action id, with no guard of its own applied here — that is exactly the
 * vulnerability E350 closed (see docs/epics/e350-list-sales-pages-unguarded.md).
 * `actions/sales-pages.ts` deliberately does NOT export a `listSalesPages`
 * action; the one legitimate caller is the admin sales-pages page's Server
 * Component, which already calls `requireAdmin()` before reaching here.
 */

import { desc } from "drizzle-orm"

import { db } from "@/lib/db"
import { salesPagesTable } from "@/lib/schema/sales"

/** List all sales pages for the admin table (newest first). */
export async function listSalesPages() {
  return db
    .select({
      id: salesPagesTable.id,
      slug: salesPagesTable.slug,
      productId: salesPagesTable.productId,
      content: salesPagesTable.content,
      renderMode: salesPagesTable.renderMode,
      status: salesPagesTable.status,
      publishedAt: salesPagesTable.publishedAt,
      updatedAt: salesPagesTable.updatedAt,
    })
    .from(salesPagesTable)
    .orderBy(desc(salesPagesTable.updatedAt))
}
