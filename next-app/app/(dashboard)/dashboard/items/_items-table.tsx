"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { ChevronRightIcon, DownloadIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { deleteItem, exportItems } from "@/actions/items"
import { DataTable } from "@/components/data-table-generic"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { StatusBadge } from "@/components/status-badge"
import { FilterChip, FilterChipBar, useFilterChipQuery } from "@/components/filter-chip"
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

export type ItemRow = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  /**
   * Synthetic status (items have no dedicated status column) — see page.tsx
   * for the exact derivation. Means "saved again since creation" — NOT
   * "content differs from creation." A no-op edit (open the dialog, submit
   * the same title) still flips this to `true`.
   */
  edited: boolean
}

/**
 * E338-defined URL query param for the items list's quick-filter chips
 * (`?status=edited` / `?status=new`, deep-linkable — E337 builds stat-card
 * links against this exact contract). Values track `ItemRow.edited`'s
 * "saved again" semantics, not a content-diff — see that field's doc comment.
 */
const STATUS_PARAM = "status"

export function ItemsTable({
  items,
  canEdit,
  initialCreateOpen = false,
  initialEditId,
  initialStatus,
}: {
  items: ItemRow[]
  canEdit: boolean
  initialCreateOpen?: boolean
  /** Open the edit modal for this id on mount (deep-link, e.g. ?edit=<id>). */
  initialEditId?: string
  /** Initial quick-filter chip selection (deep-link, e.g. ?status=edited). */
  initialStatus?: "edited" | "new"
}) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(initialCreateOpen)
  const [editItem, setEditItem] = useState<ItemRow | null>(
    () => items.find((i) => i.id === initialEditId) ?? null,
  )
  const [deleteTarget, setDeleteTarget] = useState<ItemRow | null>(null)
  const [exporting, setExporting] = useState(false)
  const [status, setStatus] = useFilterChipQuery(STATUS_PARAM, initialStatus)

  const filteredItems = useMemo(() => {
    if (status === "edited") return items.filter((i) => i.edited)
    if (status === "new") return items.filter((i) => !i.edited)
    return items
  }, [items, status])

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
      id: "status",
      accessorFn: (row) => (row.edited ? "已編輯" : "未編輯"),
      header: "狀態",
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <StatusBadge tone={row.original.edited ? "info" : "muted"}>
          {row.original.edited ? "已編輯" : "未編輯"}
        </StatusBadge>
      ),
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
        data={filteredItems}
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
        chips={
          <FilterChipBar>
            <FilterChip active={status === undefined} tone="muted" onClick={() => setStatus(undefined)}>
              全部
            </FilterChip>
            <FilterChip active={status === "edited"} tone="info" onClick={() => setStatus("edited")}>
              已編輯
            </FilterChip>
            <FilterChip active={status === "new"} tone="muted" onClick={() => setStatus("new")}>
              未編輯
            </FilterChip>
          </FilterChipBar>
        }
        renderMobileCard={(item) => (
          <button
            type="button"
            onClick={() => canEdit && setEditItem(item)}
            className="border-border/60 flex w-full items-center justify-between gap-2 border-b px-4 py-3 text-left last:border-b-0"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-medium">{item.title}</p>
              <div className="flex items-center gap-2">
                <StatusBadge tone={item.edited ? "info" : "muted"}>
                  {item.edited ? "已編輯" : "未編輯"}
                </StatusBadge>
                <span className="text-muted-foreground text-xs">{item.createdAt}</span>
              </div>
            </div>
            <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
          </button>
        )}
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
