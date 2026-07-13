"use client"

/**
 * 轉化 tab (E334) — the sales-page conversion funnel. One row per `/p/[slug]`
 * that saw traffic: 瀏覽 → CTA 點擊 → 進結帳 → 付款, each as an absolute count +
 * the step conversion rate, over a 7- or 30-day window (toggled client-side; both
 * reports are loaded server-side so the toggle needs no round-trip). Each row
 * expands to a first-party UTM channel breakdown. Uses the reusable <DataTable>.
 */
import { useMemo, useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react"

import type { FunnelRowWithChannels } from "@/lib/analytics/funnel-utils"
import { DataTable } from "@/components/data-table-generic"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

/** Format a [0,1] rate as a whole-ish percentage (e.g. 0.1234 → "12.3%"). */
function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

/** A count + its conversion-from-previous-step rate, stacked. */
function CountWithRate({ count, rate }: { count: number; rate: number }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="font-medium tabular-nums">{count.toLocaleString("zh-TW")}</span>
      <span className="text-muted-foreground text-xs tabular-nums">{pct(rate)}</span>
    </div>
  )
}

const WINDOWS = [7, 30] as const
type WindowDays = (typeof WINDOWS)[number]

export function FunnelTab({
  rowsByWindow,
}: {
  /** Pre-computed funnel rows keyed by window length in days ("7" / "30"). */
  rowsByWindow: Record<string, FunnelRowWithChannels[]>
}) {
  const [windowDays, setWindowDays] = useState<WindowDays>(7)
  const [expanded, setExpanded] = useState<string | null>(null)

  const rows = useMemo(() => rowsByWindow[String(windowDays)] ?? [], [rowsByWindow, windowDays])

  const columns: ColumnDef<FunnelRowWithChannels>[] = [
    {
      id: "expander",
      header: () => <span className="sr-only">展開</span>,
      enableGlobalFilter: false,
      cell: ({ row }) => {
        const slug = row.original.slug
        const hasChannels = row.original.channels.length > 0
        const open = expanded === slug
        return (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={!hasChannels}
            aria-label={open ? "收合渠道分解" : "展開渠道分解"}
            aria-expanded={open}
            onClick={() => setExpanded(open ? null : slug)}
          >
            {open ? (
              <ChevronDownIcon className="size-4" />
            ) : (
              <ChevronRightIcon className={cn("size-4", !hasChannels && "opacity-30")} />
            )}
          </Button>
        )
      },
    },
    {
      accessorKey: "slug",
      header: "銷售頁",
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.slug}</span>,
    },
    {
      accessorKey: "views",
      header: "瀏覽",
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">
          {row.original.views.toLocaleString("zh-TW")}
        </span>
      ),
    },
    {
      accessorKey: "ctaClicks",
      header: "CTA 點擊",
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <CountWithRate count={row.original.ctaClicks} rate={row.original.ctaRate} />
      ),
    },
    {
      accessorKey: "checkoutStarted",
      header: "進結帳",
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <CountWithRate count={row.original.checkoutStarted} rate={row.original.checkoutRate} />
      ),
    },
    {
      accessorKey: "paid",
      header: "付款",
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <CountWithRate count={row.original.paid} rate={row.original.paymentRate} />
      ),
    },
    {
      id: "overall",
      header: "整體轉化",
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">{pct(row.original.overallRate)}</span>
      ),
    },
  ]

  const expandedRow = expanded ? rows.find((r) => r.slug === expanded) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          銷售頁轉化漏斗 · 不追個人、無第三方 cookie（first-party）
        </p>
        <div className="flex items-center gap-1 rounded-lg border p-0.5">
          {WINDOWS.map((w) => (
            <Button
              key={w}
              variant={windowDays === w ? "secondary" : "ghost"}
              size="sm"
              className="h-7"
              aria-pressed={windowDays === w}
              onClick={() => setWindowDays(w)}
            >
              近 {w} 天
            </Button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        filterPlaceholder="搜尋銷售頁 slug…"
        emptyLabel="這個區間還沒有銷售頁流量資料。"
      />

      {expandedRow && (
        <div className="rounded-xl border p-4">
          <h3 className="mb-3 text-sm font-semibold">
            <span className="font-mono">{expandedRow.slug}</span> · UTM 渠道分解（近 {windowDays} 天）
          </h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>渠道</TableHead>
                  <TableHead>瀏覽</TableHead>
                  <TableHead>CTA 點擊</TableHead>
                  <TableHead>進結帳</TableHead>
                  <TableHead>付款</TableHead>
                  <TableHead>整體轉化</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expandedRow.channels.map((ch) => (
                  <TableRow key={ch.key}>
                    <TableCell className="max-w-[16rem] truncate">{ch.label}</TableCell>
                    <TableCell className="tabular-nums">
                      {ch.views.toLocaleString("zh-TW")}
                    </TableCell>
                    <TableCell>
                      <CountWithRate count={ch.ctaClicks} rate={ch.ctaRate} />
                    </TableCell>
                    <TableCell>
                      <CountWithRate count={ch.checkoutStarted} rate={ch.checkoutRate} />
                    </TableCell>
                    <TableCell>
                      <CountWithRate count={ch.paid} rate={ch.paymentRate} />
                    </TableCell>
                    <TableCell className="tabular-nums">{pct(ch.overallRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
