import { db } from "@/lib/db"
import { requireEditor } from "@/lib/permissions"
import { itemsTable } from "@/lib/schema"
import { and, eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { ItemForm } from "../../_item-form"
import { Button } from "@/components/ui/button"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "編輯項目" }

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Viewers are redirected to /dashboard by requireEditor().
  const session = await requireEditor()
  const { id } = await params

  const [item] = await db
    .select()
    .from(itemsTable)
    .where(and(eq(itemsTable.id, id), eq(itemsTable.userId, session.user.id)))

  if (!item) notFound()

  return (
    <div className="max-w-2xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">編輯項目</h1>
        <p className="text-sm text-muted-foreground mt-1">更新項目內容。</p>
      </div>

      <ItemForm id={item.id} defaultTitle={item.title} submitLabel="儲存變更" />

      <Button asChild variant="link" className="px-0">
        <Link href="/dashboard/items">← 返回項目列表</Link>
      </Button>
    </div>
  )
}
