"use client"

import { useTransition } from "react"
import { deleteUser } from "@/actions/admin"
import { Button } from "@/components/ui/button"

interface DeleteUserButtonProps {
  userId: string
  email: string
}

export function DeleteUserButton({ userId, email }: DeleteUserButtonProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2 text-xs"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Delete ${email}? This cannot be undone.`)) return
        startTransition(() => { void deleteUser(userId) })
      }}
    >
      {isPending ? "…" : "Delete"}
    </Button>
  )
}
