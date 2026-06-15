import type { Metadata } from "next"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { itemsTable } from "@/lib/schema"
import { canEdit, requireAuth } from "@/lib/permissions"
import { ItemsTable } from "./_items-table"

export const metadata: Metadata = { title: "項目" }

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string }>
}) {
  const session = await requireAuth()
  const editable = canEdit(session.user.role)
  const { new: newParam, edit: editParam } = await searchParams

  const items = await db
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.userId, session.user.id))
    .orderBy(itemsTable.createdAt)

  const rows = items.map((i) => ({
    id: i.id,
    title: i.title,
    createdAt: i.createdAt.toLocaleDateString(),
    updatedAt: i.updatedAt.toLocaleDateString(),
  }))

  return (
    <div className="max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">項目</h1>
        <p className="text-muted-foreground mt-1 text-sm">管理你的項目。</p>
      </div>
      <ItemsTable
        items={rows}
        canEdit={editable}
        initialCreateOpen={editable && newParam === "1"}
        initialEditId={editable ? editParam : undefined}
      />
    </div>
  )
}
