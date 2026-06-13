"use client"

import { useTransition } from "react"
import { deleteItem } from "@/actions/items"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface DeleteButtonProps {
  id: string
}

export function DeleteButton({ id }: DeleteButtonProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm("確定要刪除這個項目嗎？")) return
        startTransition(async () => {
          const result = await deleteItem(id)
          if (result?.error) toast.error(result.error)
        })
      }}
      className="text-destructive hover:text-destructive"
    >
      {isPending ? "刪除中…" : "刪除"}
    </Button>
  )
}
