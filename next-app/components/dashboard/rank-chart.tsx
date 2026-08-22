import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * Rank chart (E337) — a Top-N horizontal ranking bar with the remainder
 * collapsed into a single "other" row. Pure CSS bars, Server Component.
 */
export interface RankChartRow {
  label: string
  value: number
}

export interface RankChartProps {
  title?: string
  rows: RankChartRow[]
  /** How many rows to show individually before collapsing the rest. Default 5. */
  topN?: number
  /** Label for the collapsed remainder row. Default "其他". */
  otherLabel?: string
  emptyText?: string
  className?: string
}

export function RankChart({
  title,
  rows,
  topN = 5,
  otherLabel = "其他",
  emptyText = "暫無資料",
  className,
}: RankChartProps) {
  const sorted = [...rows].sort((a, b) => b.value - a.value)
  const top = sorted.slice(0, topN)
  const rest = sorted.slice(topN)
  const restTotal = rest.reduce((sum, r) => sum + r.value, 0)
  const display = restTotal > 0 ? [...top, { label: otherLabel, value: restTotal }] : top
  const max = Math.max(1, ...display.map((r) => r.value))

  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={cn("flex flex-col gap-2", title ? "" : "pt-6")}>
        {display.length === 0 ? (
          <p className="text-muted-foreground py-2 text-sm">{emptyText}</p>
        ) : (
          display.map((row) => (
            <div key={row.label} className="flex items-center gap-2.5">
              <span className="w-20 shrink-0 truncate text-xs font-medium">{row.label}</span>
              <div className="bg-muted relative h-2.5 flex-1 overflow-hidden rounded-full">
                <div
                  className="bg-primary absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${(row.value / max) * 100}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-xs font-bold tabular-nums">
                {row.value}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
