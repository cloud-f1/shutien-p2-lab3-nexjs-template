import type { Metadata } from "next"

import { requireAuth } from "@/lib/permissions"
import { getEntitledProducts } from "@/lib/entitlements"
import { LibraryTable } from "./_library-table"

export const metadata: Metadata = { title: "我的內容庫" }

export default async function LibraryPage() {
  const session = await requireAuth()

  // Live, server-side ownership read — the list is derived from PAID orders, never
  // from any client-supplied flag.
  const products = await getEntitledProducts(session.user.id)

  const rows = products.map((p) => ({
    slug: p.slug,
    name: p.name,
    description: p.description ?? "",
    purchasedAt: p.purchasedAt ? p.purchasedAt.toLocaleDateString() : "—",
  }))

  return (
    <div className="max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">我的內容庫</h1>
        <p className="text-muted-foreground mt-1 text-sm">您購買的所有內容，隨時可在此存取。</p>
      </div>
      <LibraryTable items={rows} />
    </div>
  )
}
