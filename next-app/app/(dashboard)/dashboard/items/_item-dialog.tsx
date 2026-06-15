"use client"

import { useRouter } from "next/navigation"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ItemForm } from "./_item-form"

export function ItemDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Provided → edit mode; omitted → create mode. */
  item?: { id: string; title: string } | null
}) {
  const router = useRouter()
  const editing = Boolean(item)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "編輯項目" : "新增項目"}</DialogTitle>
          <DialogDescription>
            {editing ? "更新此項目的內容。" : "建立一個新的項目。"}
          </DialogDescription>
        </DialogHeader>
        <ItemForm
          id={item?.id}
          defaultTitle={item?.title ?? ""}
          submitLabel={editing ? "儲存變更" : "建立"}
          onCancel={() => onOpenChange(false)}
          onSuccess={() => {
            onOpenChange(false)
            router.refresh()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
