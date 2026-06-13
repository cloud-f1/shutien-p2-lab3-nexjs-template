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
  userEmail: string
  currentRole: Role
  isSelf: boolean
}

const ROLE_LABELS: Record<Role, string> = {
  admin: "管理員",
  editor: "編輯者",
  viewer: "檢視者",
}

export function RoleSelector({ userId, userEmail, currentRole, isSelf }: RoleSelectorProps) {
  const [isPending, startTransition] = useTransition()

  if (isSelf) {
    return <span className="text-sm text-muted-foreground">{ROLE_LABELS[currentRole]}</span>
  }

  return (
    <Select
      defaultValue={currentRole}
      disabled={isPending}
      onValueChange={(value) =>
        startTransition(() => { void setUserRole(userId, value as Role) })
      }
    >
      <SelectTrigger className="w-28 h-8 text-xs" aria-label={`變更 ${userEmail} 的角色`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">管理員</SelectItem>
        <SelectItem value="editor">編輯者</SelectItem>
        <SelectItem value="viewer">檢視者</SelectItem>
      </SelectContent>
    </Select>
  )
}
