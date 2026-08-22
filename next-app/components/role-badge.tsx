import { cn } from "@/lib/utils"
import type { Role } from "@/lib/schema"
import { StatusBadge, type StatusTone } from "@/components/status-badge"

/**
 * Role badge (E338) — renders the 3-tier RBAC `Role` (admin/editor/viewer)
 * through the existing `<StatusBadge>` so it shares the exact tone
 * vocabulary/markup instead of a parallel implementation. Copy + tone come
 * from a single lookup table below — adding/renaming a role only touches
 * this one place.
 */
const ROLE_META: Record<Role, { label: string; tone: StatusTone }> = {
  admin: { label: "管理員", tone: "danger" },
  editor: { label: "編輯者", tone: "info" },
  viewer: { label: "檢視者", tone: "muted" },
}

export interface RoleBadgeProps {
  role: Role
  size?: "md" | "sm"
  className?: string
}

export function RoleBadge({ role, size = "md", className }: RoleBadgeProps) {
  const meta = ROLE_META[role]
  return (
    <StatusBadge
      tone={meta.tone}
      className={cn(size === "sm" && "px-1.5 py-0 text-[11px]", className)}
    >
      {meta.label}
    </StatusBadge>
  )
}
