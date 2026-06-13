"use client"

import { useTransition } from "react"
import { deleteItem } from "@/actions/items"
import { Button } from "@/components/ui/button"

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
        if (!confirm("Delete this item?")) return
        startTransition(() => deleteItem(id))
      }}
      className="text-destructive hover:text-destructive"
    >
      {isPending ? "Deleting…" : "Delete"}
    </Button>
  )
}
