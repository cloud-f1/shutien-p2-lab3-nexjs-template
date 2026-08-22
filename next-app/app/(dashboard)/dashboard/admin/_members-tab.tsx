"use client"

/**
 * 會員 tab (E331) — the site-wide member list migrated from a raw <Table> to the
 * reusable <DataTable> (CLAUDE.md convention: filter + pagination built-in). All
 * existing member controls are preserved (role change / delete / TOTP reset), and
 * a per-row 詳情 button opens the member-detail modal (orders + entitlements +
 * subscription). Team invitations + the permission matrix are rendered by the
 * page below this table so the 邀請 surface is unchanged.
 */
import { useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { InfoIcon } from "lucide-react"

import type { Role } from "@/lib/schema"
import { DataTable } from "@/components/data-table-generic"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"

import { RoleSelector } from "./_role-selector"
import { DeleteUserButton } from "./_delete-user-button"
import { ResetTotpButton } from "./_reset-totp-button"
import { MemberDetailDialog } from "./_member-detail-dialog"

export interface MemberRow {
  id: string
  name: string | null
  email: string
  role: Role
  emailVerified: boolean
  totpEnabled: boolean
  createdAt: string
}

export function MembersTab({
  members,
  currentUserId,
}: {
  members: MemberRow[]
  currentUserId: string
}) {
  const [detailFor, setDetailFor] = useState<MemberRow | null>(null)

  const columns: ColumnDef<MemberRow>[] = [
    {
      accessorKey: "name",
      header: "姓名",
      cell: ({ row }) => <span className="font-medium">{row.original.name ?? "—"}</span>,
    },
    {
      accessorKey: "email",
      header: "電子郵件",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span>,
    },
    {
      accessorKey: "role",
      header: "角色",
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <RoleSelector
          userId={row.original.id}
          userEmail={row.original.email}
          currentRole={row.original.role}
          isSelf={row.original.id === currentUserId}
        />
      ),
    },
    {
      accessorKey: "emailVerified",
      header: "已驗證",
      enableGlobalFilter: false,
      cell: ({ row }) =>
        row.original.emailVerified ? (
          <StatusBadge tone="success">是</StatusBadge>
        ) : (
          <StatusBadge tone="muted">否</StatusBadge>
        ),
    },
    {
      accessorKey: "createdAt",
      header: "加入時間",
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.original.createdAt}</span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">操作</span>,
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setDetailFor(row.original)}
          >
            <InfoIcon className="size-4" /> 詳情
          </Button>
          {row.original.totpEnabled && (
            <ResetTotpButton userId={row.original.id} email={row.original.email} />
          )}
          {row.original.id !== currentUserId && (
            <DeleteUserButton userId={row.original.id} email={row.original.email} />
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={members}
        filterPlaceholder="搜尋姓名或電子郵件…"
        emptyLabel="尚無使用者。"
        dense
      />
      <MemberDetailDialog
        open={Boolean(detailFor)}
        onOpenChange={(o) => !o && setDetailFor(null)}
        userId={detailFor?.id ?? null}
        memberEmail={detailFor?.email ?? null}
      />
    </>
  )
}
