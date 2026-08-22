import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * Stack chart (E337) — category × segment stacked horizontal bars. A pure
 * CSS bar (no charting library needed), so this stays a Server Component.
 *
 * `segments[].color` is an optional Tailwind background class (e.g.
 * `"bg-success"`) supplied by the caller — never a raw hex/inline style, to
 * stay clear of the Stop-verifier's inline-style-color rule. When omitted,
 * segments cycle through the `--chart-1..5` design tokens by position so the
 * kit still looks coherent with zero caller-side styling.
 */
const CHART_BG = [
  "bg-[var(--chart-1)]",
  "bg-[var(--chart-2)]",
  "bg-[var(--chart-3)]",
  "bg-[var(--chart-4)]",
  "bg-[var(--chart-5)]",
] as const

export interface StackChartSegment {
  key: string
  value: number
  /** Tailwind background class, e.g. "bg-success". Omit to cycle the chart tokens. */
  color?: string
}

export interface StackChartRow {
  label: string
  segments: StackChartSegment[]
}

export interface StackChartProps {
  title?: string
  rows: StackChartRow[]
  className?: string
}

export function StackChart({ title, rows, className }: StackChartProps) {
  const max = Math.max(1, ...rows.map((r) => r.segments.reduce((sum, s) => sum + s.value, 0)))

  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={cn("flex flex-col gap-2.5", title ? "" : "pt-6")}>
        {rows.map((row) => {
          const total = row.segments.reduce((sum, s) => sum + s.value, 0)
          return (
            <div
              key={row.label}
              className="grid grid-cols-[minmax(0,96px)_1fr_2.5rem] items-center gap-2.5"
            >
              <span className="truncate text-xs font-medium">{row.label}</span>
              <div className="bg-muted flex h-3.5 overflow-hidden rounded-full">
                {row.segments.map((seg, i) =>
                  seg.value > 0 ? (
                    <div
                      key={seg.key}
                      title={`${seg.key} ${seg.value}`}
                      className={seg.color ?? CHART_BG[i % CHART_BG.length]}
                      style={{ width: `${(seg.value / max) * 100}%` }}
                    />
                  ) : null,
                )}
              </div>
              <span className="text-right text-xs font-bold tabular-nums">{total}</span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
