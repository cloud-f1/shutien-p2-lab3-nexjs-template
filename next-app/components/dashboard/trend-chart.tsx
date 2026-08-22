"use client"

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

/**
 * Trend chart (E337) — a monthly/periodic trend area chart, following the
 * exact Recharts + `ChartContainer`/`ChartConfig` convention already
 * established in `chart-area-interactive.tsx` (gradient fill under a single
 * series, `--chart-1` token, no hardcoded hex).
 */
export interface TrendChartDatum {
  label: string
  value: number
}

export interface TrendChartProps {
  title?: string
  data: TrendChartDatum[]
  /** Series name shown in the tooltip/legend, e.g. "新增項目". */
  valueLabel: string
  /** Chart height in px. Set via inline style (a size, not a color). */
  height?: number
  className?: string
}

export function TrendChart({ title, data, valueLabel, height = 200, className }: TrendChartProps) {
  const chartConfig = {
    value: { label: valueLabel, color: "var(--chart-1)" },
  } satisfies ChartConfig

  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={cn("px-2 sm:px-6", title ? "pt-4 sm:pt-6" : "pt-6")}>
        <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height }}>
          <AreaChart data={data} role="img" aria-label={`${valueLabel}趨勢圖`}>
            <defs>
              <linearGradient id="fillTrendValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <Area
              dataKey="value"
              type="natural"
              fill="url(#fillTrendValue)"
              stroke="var(--color-value)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
