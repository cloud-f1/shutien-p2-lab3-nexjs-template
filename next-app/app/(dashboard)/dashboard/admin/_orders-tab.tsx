"use client"

/**
 * 訂單 tab (E331) — site-wide one-time orders in the reusable <DataTable>. Row
 * actions (admin-gated Server Actions): 重寄啟用信 (idempotent activation resend)
 * and 標記退款 (orders.status → refunded; the E328 entitlement fails implicitly
 * since it only counts `paid` orders — no second toggle). 標記退款 uses the
 * ConfirmDialog convention (E273) since it is destructive.
 */
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { MailIcon, RotateCcwIcon } from "lucide-react"

import { markRefunded, resendActivation } from "@/actions/admin-revenue"
import type { AdminOrderRow } from "@/lib/billing/queries"
import { formatAmount } from "@/lib/billing/billing-utils"
import { DataTable } from "@/components/data-table-generic"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"

import { ORDER_STATUS_META } from "./_order-status"

/** Client row shape — Dates arrive as ISO strings from the server component. */
export interface OrderRow extends Omit<AdminOrderRow, "createdAt" | "paidAt"> {
  createdAt: string
  paidAt: string | null
}

/** Short, readable order reference from the uuid (full id kept for actions). */
function shortRef(id: string): string {
  return id.slice(0, 8)
}

export function OrdersTab({ orders }: { orders: OrderRow[] }) {
  const router = useRouter()
  const [refundTarget, setRefundTarget] = useState<OrderRow | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null)
  const [, startTransition] = useTransition()

  function handleResend(order: OrderRow) {
    setNotice(null)
    setResendingId(order.id)
    startTransition(async () => {
      const res = await resendActivation(order.id)
      setResendingId(null)
      if (res.error) setNotice({ tone: "danger", text: res.error })
      else {
        setNotice({ tone: "success", text: `已重寄啟用信至 ${order.customerEmail}。` })
        router.refresh()
      }
    })
  }

  const columns: ColumnDef<OrderRow>[] = [
    {
      accessorKey: "id",
      header: "訂單號",
      cell: ({ row }) => <span className="mono text-xs">{shortRef(row.original.id)}</span>,
    },
    {
      accessorKey: "productName",
      header: "產品",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.productName ?? "—"}</span>
      ),
    },
    {
      accessorKey: "customerEmail",
      header: "買家",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.customerEmail}</span>
      ),
    },
    {
      accessorKey: "amount",
      header: "金額",
      enableGlobalFilter: false,
      cell: ({ row }) => formatAmount(row.original.amount, row.original.currency),
    },
    {
      accessorKey: "provider",
      header: "金流",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.provider}</span>,
    },
    {
      // Filterable by status: the accessor returns the Chinese label so the
      // DataTable global filter matches on "已付款" / "已退款" etc.
      id: "status",
      accessorFn: (row) => ORDER_STATUS_META[row.status].label,
      header: "狀態",
      cell: ({ row }) => {
        const meta = ORDER_STATUS_META[row.original.status]
        return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
      },
    },
    {
      accessorKey: "createdAt",
      header: "時間",
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </span>
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
            disabled={resendingId === row.original.id}
            onClick={() => handleResend(row.original)}
          >
            <MailIcon className="size-4" />
            {resendingId === row.original.id ? "寄送中…" : "重寄啟用信"}
          </Button>
          {row.original.status === "paid" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2 text-xs"
              onClick={() => setRefundTarget(row.original)}
            >
              <RotateCcwIcon className="size-4" /> 標記退款
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-3">
      {notice && (
        <StatusBadge tone={notice.tone === "success" ? "success" : "danger"}>
          {notice.text}
        </StatusBadge>
      )}
      <DataTable
        columns={columns}
        data={orders}
        filterPlaceholder="搜尋產品 / 買家 / 狀態…"
        emptyLabel="尚無訂單。"
        dense
      />
      <ConfirmDialog
        open={Boolean(refundTarget)}
        onOpenChange={(o) => !o && setRefundTarget(null)}
        title="標記退款"
        description={
          refundTarget
            ? `確定要將訂單 ${shortRef(refundTarget.id)}（${refundTarget.customerEmail}）標記為已退款嗎？此操作會立即收回該產品的內容權限，且不會在金流商後台自動退刷。`
            : undefined
        }
        confirmLabel="標記退款"
        destructive
        onConfirm={async () => {
          if (!refundTarget) return
          const res = await markRefunded(refundTarget.id)
          if (res.error) return { error: res.error }
          router.refresh()
        }}
      />
    </div>
  )
}
