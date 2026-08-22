"use client"

// E339 — record-detail header region: title + status + edit/delete actions.
// "use client" only because it owns the edit/delete dialog open state and
// announces the record's title to the breadcrumb (both need the browser) —
// it still receives every value as props; it never imports `db`.

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PencilIcon, Trash2Icon } from "lucide-react"

import { deleteItem } from "@/actions/items"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { StatusBadge } from "@/components/status-badge"
import { DynamicBreadcrumbLabel } from "@/components/dynamic-breadcrumb-label"
import { ItemDialog } from "../../_item-dialog"
import type { ItemDetailVM } from "./types"

export function Header({
  item,
  /** Owner + canEdit(role) — matches the ownership-scoped WHERE in actions/items.ts. */
  canMutate,
}: {
  item: ItemDetailVM
  canMutate: boolean
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <div className="space-y-3">
      <DynamicBreadcrumbLabel label={item.title} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold break-words">{item.title}</h1>
            <StatusBadge tone={item.edited ? "info" : "muted"}>
              {item.edited ? "已編輯" : "未編輯"}
            </StatusBadge>
          </div>
        </div>
        {canMutate && (
          <div className="flex shrink-0 gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <PencilIcon className="size-4" /> 編輯
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2Icon className="size-4" /> 刪除
            </Button>
          </div>
        )}
      </div>

      {canMutate && (
        <>
          {/* E273 convention: edit stays in the existing modal. onSuccess inside
              ItemDialog already calls router.refresh() — which re-runs this
              Server Component page and re-fetches fresh data — so saving here
              stays on the detail page instead of redirecting anywhere. */}
          <ItemDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            item={{ id: item.id, title: item.title }}
          />
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title="刪除項目"
            description={`確定要刪除「${item.title}」嗎？此操作無法復原。`}
            confirmLabel="刪除"
            destructive
            onConfirm={async () => {
              const res = await deleteItem(item.id)
              if (res?.error) return { error: res.error }
              // Delete convention (E273): return to the list, the record is gone.
              router.push("/dashboard/items")
            }}
          />
        </>
      )}
    </div>
  )
}
