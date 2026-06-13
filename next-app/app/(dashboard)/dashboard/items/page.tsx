import { db } from "@/lib/db"
import { canEdit, requireAuth } from "@/lib/permissions"
import { itemsTable } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { Button } from "@/components/ui/button"
import { DeleteButton } from "@/components/delete-button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "項目" }

export default async function ItemsPage() {
  const session = await requireAuth()
  const userId = session.user.id
  const editable = canEdit(session.user.role)

  const items = await db
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.userId, userId))
    .orderBy(itemsTable.createdAt)

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">項目</h1>
          <p className="text-sm text-muted-foreground mt-1">共 {items.length} 個項目</p>
        </div>
        {editable && (
          <Button asChild>
            <Link href="/dashboard/items/create">+ 新增項目</Link>
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>標題</TableHead>
            <TableHead>建立時間</TableHead>
            <TableHead>更新時間</TableHead>
            {editable && <TableHead className="w-32 text-right">操作</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={editable ? 4 : 3}
                className="h-24 text-center text-muted-foreground"
              >
                尚無項目。
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.title}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {item.createdAt.toLocaleDateString()}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {item.updatedAt.toLocaleDateString()}
                </TableCell>
                {editable && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/dashboard/items/${item.id}/edit`}>編輯</Link>
                      </Button>
                      <DeleteButton id={item.id} />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
