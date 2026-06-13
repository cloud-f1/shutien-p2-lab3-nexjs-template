"use client"

import { useTransition } from "react"
import { setUserRole } from "@/actions/admin"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Role } from "@/lib/schema"

interface RoleSelectorProps {
  userId: string
  currentRole: Role
  isSelf: boolean
}

export function RoleSelector({ userId, currentRole, isSelf }: RoleSelectorProps) {
  const [isPending, startTransition] = useTransition()

  if (isSelf) {
    return <span className="text-sm text-muted-foreground capitalize">{currentRole}</span>
  }

  return (
    <Select
      defaultValue={currentRole}
      disabled={isPending}
      onValueChange={(value) =>
        startTransition(() => { void setUserRole(userId, value as Role) })
      }
    >
      <SelectTrigger className="w-28 h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">admin</SelectItem>
        <SelectItem value="editor">editor</SelectItem>
        <SelectItem value="viewer">viewer</SelectItem>
      </SelectContent>
    </Select>
  )
}
