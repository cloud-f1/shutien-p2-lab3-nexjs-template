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
  searchParams: Promise<{ new?: string; edit?: string; status?: string }>
}) {
  const session = await requireAuth()
  const editable = canEdit(session.user.role)
  const { new: newParam, edit: editParam, status: statusParam } = await searchParams

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
    // Synthetic "status" (no dedicated status column on items) — true once the
    // item has been saved again after creation. Drives the E338 status badge
    // + quick-filter chips demo on this list.
    //
    // IMPORTANT semantics: `edited` means "the row was saved again" (any
    // Server Action UPDATE — including opening the edit dialog and submitting
    // an unchanged title), NOT "the content differs from what was created."
    // Postgres `now()` is stable within a transaction, so a single-statement
    // INSERT gives `createdAt === updatedAt` exactly; any later UPDATE bumps
    // `updatedAt`, edited or not. E337's stat-card deep links (`?status=`)
    // inherit this exact meaning — don't read 已編輯 as "content changed".
    edited: i.updatedAt.getTime() !== i.createdAt.getTime(),
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
        initialStatus={statusParam === "edited" || statusParam === "new" ? statusParam : undefined}
      />
    </div>
  )
}
