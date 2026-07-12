"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SalesPageForm } from "./_sales-page-form"
import type { SalesPageRow } from "./_sales-pages-table"

export type ProductOption = { id: string; name: string; slug: string }

export function SalesPageDialog({
  open,
  onOpenChange,
  products,
  page,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: ProductOption[]
  /** Provided → edit mode; omitted → create mode. */
  page?: SalesPageRow | null
  onSuccess: () => void
}) {
  const editing = Boolean(page)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "編輯銷售頁" : "新增銷售頁"}</DialogTitle>
          <DialogDescription>
            內容依 AIDA 結構分區。儲存前會以同一份 Zod 契約驗證，欄位有誤會逐項提示。
          </DialogDescription>
        </DialogHeader>
        {/* Remount the form per target so defaultValues reset between create/edit. */}
        <SalesPageForm
          key={page?.id ?? "new"}
          products={products}
          page={page ?? null}
          onSuccess={onSuccess}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
