"use client"

import { type ColumnDef } from "@tanstack/react-table"

import type { AuditEntry } from "@/lib/audit"
import { DataTable } from "@/components/data-table-generic"
import { StatusBadge } from "@/components/status-badge"

const auditColumns: ColumnDef<AuditEntry>[] = [
  {
    accessorKey: "action",
    header: "操作",
    cell: ({ row }) => (
      <StatusBadge tone="info" className="mono">
        {row.original.action}
      </StatusBadge>
    ),
  },
  {
    id: "actorEmail",
    accessorFn: (row) => row.actorEmail ?? "系統",
    header: "執行者",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.actorEmail ?? "系統"}</span>
    ),
  },
  {
    id: "target",
    accessorFn: (row) =>
      row.targetType
        ? `${row.targetType}${row.targetId ? `:${row.targetId.slice(0, 8)}` : ""}`
        : "—",
    header: "對象",
    cell: ({ row }) => (
      <span className="text-muted-foreground mono text-xs">
        {row.original.targetType
          ? `${row.original.targetType}${row.original.targetId ? `:${row.original.targetId.slice(0, 8)}` : ""}`
          : "—"}
      </span>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "時間",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">
        {row.original.createdAt.toLocaleString()}
      </span>
    ),
  },
]

export function AuditPanel({ entries }: { entries: AuditEntry[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-medium">稽核紀錄</h2>
        <p className="text-muted-foreground text-sm">
          敏感操作的紀錄（角色變更、金鑰撤銷、邀請等）。僅管理員可見。
        </p>
      </div>
      <DataTable
        columns={auditColumns}
        data={entries}
        filterPlaceholder="搜尋操作、執行者…"
        emptyLabel="尚無稽核紀錄。"
      />
    </div>
  )
}
