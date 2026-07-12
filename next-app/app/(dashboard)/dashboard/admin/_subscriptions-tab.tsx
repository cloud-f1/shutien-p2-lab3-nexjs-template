"use client"

/**
 * 訂閱 tab (E331) — site-wide recurring subscriptions in the reusable <DataTable>,
 * READ-ONLY. This system does not call any provider cancel/refund API from here;
 * gateway-side subscription management lives in each provider's own back office
 * (Stripe dashboard / ECPay 廠商後台). Data comes from listAllSubscriptions().
 */
import { type ColumnDef } from "@tanstack/react-table"

import type { AdminSubscriptionRow } from "@/lib/billing/queries"
import { formatAmount, subscriptionStatusLabel } from "@/lib/billing/billing-utils"
import { DataTable } from "@/components/data-table-generic"
import { StatusBadge } from "@/components/status-badge"

/** Client row shape — Dates arrive as ISO strings from the server component. */
export interface SubscriptionRow
  extends Omit<AdminSubscriptionRow, "currentPeriodEnd" | "createdAt"> {
  currentPeriodEnd: string | null
  createdAt: string
}

export function SubscriptionsTab({ subscriptions }: { subscriptions: SubscriptionRow[] }) {
  const columns: ColumnDef<SubscriptionRow>[] = [
    {
      accessorKey: "userEmail",
      header: "用戶",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.userEmail ?? "—"}</span>
      ),
    },
    {
      accessorKey: "interval",
      header: "方案",
      cell: ({ row }) =>
        row.original.amount != null ? (
          <span>
            {formatAmount(row.original.amount, row.original.currency ?? "usd")}
            {row.original.interval ? `/${row.original.interval}` : ""}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "provider",
      header: "金流",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.provider}</span>,
    },
    {
      id: "status",
      accessorFn: (row) => subscriptionStatusLabel(row.status).label,
      header: "狀態",
      cell: ({ row }) => {
        const meta = subscriptionStatusLabel(row.original.status)
        return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
      },
    },
    {
      accessorKey: "currentPeriodEnd",
      header: "本期到期",
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {row.original.currentPeriodEnd
            ? new Date(row.original.currentPeriodEnd).toLocaleDateString()
            : "—"}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        訂閱為唯讀檢視。取消 / 退訂 / 退款請至各金流商後台（Stripe Dashboard 或 ECPay 廠商後台）操作。
      </p>
      <DataTable
        columns={columns}
        data={subscriptions}
        filterPlaceholder="搜尋用戶 / 狀態…"
        emptyLabel="尚無訂閱。"
      />
    </div>
  )
}
