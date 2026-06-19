"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { DownloadIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { deleteItem, exportItems } from "@/actions/items"
import { DataTable } from "@/components/data-table-generic"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { ItemDialog } from "./_item-dialog"

function triggerDownload(data: string, filename: string, contentType: string) {
  const blob = new Blob([data], { type: contentType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export type ItemRow = { id: string; title: string; createdAt: string; updatedAt: string }

export function ItemsTable({
  items,
  canEdit,
  initialCreateOpen = false,
  initialEditId,
}: {
  items: ItemRow[]
  canEdit: boolean
  initialCreateOpen?: boolean
  /** Open the edit modal for this id on mount (deep-link, e.g. ?edit=<id>). */
  initialEditId?: string
}) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(initialCreateOpen)
  const [editItem, setEditItem] = useState<ItemRow | null>(
    () => items.find((i) => i.id === initialEditId) ?? null,
  )
  const [deleteTarget, setDeleteTarget] = useState<ItemRow | null>(null)
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const result = await exportItems()
      if (result.success) {
        triggerDownload(result.data, result.filename, result.contentType)
      }
    } finally {
      setExporting(false)
    }
  }

  const columns: ColumnDef<ItemRow>[] = [
    {
      accessorKey: "title",
      header: "標題",
      cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
    },
    {
      accessorKey: "createdAt",
      header: "建立時間",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.createdAt}</span>,
    },
    {
      accessorKey: "updatedAt",
      header: "更新時間",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.updatedAt}</span>,
    },
    ...(canEdit
      ? [
          {
            id: "actions",
            header: () => <span className="sr-only">操作</span>,
            enableGlobalFilter: false,
            cell: ({ row }) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditItem(row.original)}>
                  <PencilIcon className="size-4" /> 編輯
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(row.original)}
                >
                  <Trash2Icon className="size-4" /> 刪除
                </Button>
              </div>
            ),
          } satisfies ColumnDef<ItemRow>,
        ]
      : []),
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={items}
        filterPlaceholder="搜尋項目…"
        emptyLabel="尚無項目。"
        toolbar={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              <DownloadIcon className="size-4" />
              {exporting ? "匯出中…" : "匯出 JSON"}
            </Button>
            {canEdit && (
              <Button onClick={() => setCreateOpen(true)}>
                <PlusIcon className="size-4" /> 新增項目
              </Button>
            )}
          </div>
        }
      />

      {canEdit && (
        <>
          <ItemDialog open={createOpen} onOpenChange={setCreateOpen} />
          <ItemDialog
            open={Boolean(editItem)}
            onOpenChange={(o) => !o && setEditItem(null)}
            item={editItem}
          />
          <ConfirmDialog
            open={Boolean(deleteTarget)}
            onOpenChange={(o) => !o && setDeleteTarget(null)}
            title="刪除項目"
            description={
              deleteTarget ? `確定要刪除「${deleteTarget.title}」嗎？此操作無法復原。` : undefined
            }
            confirmLabel="刪除"
            destructive
            onConfirm={async () => {
              if (!deleteTarget) return
              const res = await deleteItem(deleteTarget.id)
              if (res?.error) return { error: res.error }
              router.refresh()
            }}
          />
        </>
      )}
    </>
  )
}
