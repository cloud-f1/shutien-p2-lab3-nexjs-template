import type { Metadata } from "next"
import { asc } from "drizzle-orm"

import { listSalesPages } from "@/actions/sales-pages"
import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/permissions"
import { productsTable } from "@/lib/schema"
import { SalesPagesTable, type SalesPageRow } from "./_sales-pages-table"

export const metadata: Metadata = { title: "管理 — 銷售頁" }

export default async function AdminSalesPagesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string }>
}) {
  await requireAdmin()
  const { new: newParam, edit: editParam } = await searchParams

  const [pages, products] = await Promise.all([
    listSalesPages(),
    db
      .select({ id: productsTable.id, name: productsTable.name, slug: productsTable.slug })
      .from(productsTable)
      .orderBy(asc(productsTable.name)),
  ])

  const rows: SalesPageRow[] = pages.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.content?.meta?.title ?? p.slug,
    productId: p.productId,
    renderMode: p.renderMode,
    status: p.status,
    updatedAt: p.updatedAt.toLocaleDateString(),
    content: p.content,
  }))

  return (
    <div className="max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">銷售頁管理</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          建立、編輯並發佈一頁式銷售頁。發佈後 <code>/p/&lt;slug&gt;</code> 立即生效，無需重新部署。
        </p>
      </div>
      <SalesPagesTable
        rows={rows}
        products={products}
        initialCreateOpen={newParam === "1"}
        initialEditId={editParam}
      />
    </div>
  )
}
