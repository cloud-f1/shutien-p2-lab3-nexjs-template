"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { type ColumnDef } from "@tanstack/react-table"
import {
  ExternalLinkIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
  UndoIcon,
} from "lucide-react"

import {
  createSalesPagePreviewLink,
  deleteSalesPage,
  setSalesPageStatus,
} from "@/actions/sales-pages"
import type { SalesPageContent } from "@/lib/sales/content"
import type { SalesPageRenderMode, SalesPageStatus } from "@/lib/schema/sales"
import { DataTable } from "@/components/data-table-generic"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SalesPageDialog, type ProductOption } from "./_sales-page-dialog"

export type SalesPageRow = {
  id: string
  slug: string
  title: string
  productId: string | null
  renderMode: SalesPageRenderMode
  status: SalesPageStatus
  updatedAt: string
  content: SalesPageContent
}

export function SalesPagesTable({
  rows,
  products,
  initialCreateOpen = false,
  initialEditId,
}: {
  rows: SalesPageRow[]
  products: ProductOption[]
  initialCreateOpen?: boolean
  initialEditId?: string
}) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(initialCreateOpen)
  const [editRow, setEditRow] = useState<SalesPageRow | null>(
    () => rows.find((r) => r.id === initialEditId) ?? null,
  )
  const [deleteTarget, setDeleteTarget] = useState<SalesPageRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const productName = (id: string | null) =>
    id ? (products.find((p) => p.id === id)?.name ?? "（已移除）") : "—"

  async function handleToggleStatus(row: SalesPageRow) {
    setBusyId(row.id)
    try {
      const next = row.status === "published" ? "draft" : "published"
      const res = await setSalesPageStatus(row.id, next)
      if (!res.error) router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function handlePreview(row: SalesPageRow) {
    setBusyId(row.id)
    try {
      const res = await createSalesPagePreviewLink(row.id)
      if (res.url) {
        setPreviewUrl(res.url)
        window.open(res.url, "_blank", "noopener,noreferrer")
      }
    } finally {
      setBusyId(null)
    }
  }

  const columns: ColumnDef<SalesPageRow>[] = [
    {
      accessorKey: "slug",
      header: "網址代稱",
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.slug}</span>,
    },
    {
      accessorKey: "title",
      header: "標題",
      cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
    },
    {
      id: "product",
      header: "連結產品",
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{productName(row.original.productId)}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "狀態",
      enableGlobalFilter: false,
      cell: ({ row }) => {
        const { status, renderMode } = row.original
        return (
          <div className="flex items-center gap-1.5">
            <Badge variant={status === "published" ? "default" : "secondary"}>
              {status === "published" ? "已發佈" : "草稿"}
            </Badge>
            {renderMode === "custom" && (
              <Badge variant="outline" className="text-muted-foreground">
                由 code 管理 (E333)
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "updatedAt",
      header: "更新時間",
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.original.updatedAt}</span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">操作</span>,
      enableGlobalFilter: false,
      cell: ({ row }) => {
        const r = row.original
        const busy = busyId === r.id
        return (
          <div className="flex flex-wrap justify-end gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/p/${r.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon className="size-4" /> 檢視
              </Link>
            </Button>
            {r.status === "draft" && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => handlePreview(r)}>
                <EyeIcon className="size-4" /> 預覽
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setEditRow(r)}>
              <PencilIcon className="size-4" /> 編輯
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => handleToggleStatus(r)}
            >
              {r.status === "published" ? (
                <>
                  <UndoIcon className="size-4" /> 下架
                </>
              ) : (
                <>
                  <SendIcon className="size-4" /> 發佈
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteTarget(r)}
            >
              <Trash2Icon className="size-4" /> 刪除
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        filterPlaceholder="搜尋網址代稱或標題…"
        emptyLabel="尚無銷售頁。點「新增銷售頁」建立第一個。"
        toolbar={
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" /> 新增銷售頁
          </Button>
        }
      />

      {previewUrl && (
        <p className="text-muted-foreground text-xs">
          預覽連結已在新分頁開啟（1 小時內有效）：
          <span className="ml-1 font-mono break-all">{previewUrl}</span>
        </p>
      )}

      <SalesPageDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        products={products}
        onSuccess={() => {
          setCreateOpen(false)
          router.refresh()
        }}
      />
      <SalesPageDialog
        open={Boolean(editRow)}
        onOpenChange={(o) => !o && setEditRow(null)}
        products={products}
        page={editRow}
        onSuccess={() => {
          setEditRow(null)
          router.refresh()
        }}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="刪除銷售頁"
        description={
          deleteTarget
            ? `確定要刪除「${deleteTarget.title}」(${deleteTarget.slug}) 嗎？此操作無法復原。`
            : undefined
        }
        confirmLabel="刪除"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return
          const res = await deleteSalesPage(deleteTarget.id)
          if (res?.error) return { error: res.error }
          router.refresh()
        }}
      />
    </>
  )
}
