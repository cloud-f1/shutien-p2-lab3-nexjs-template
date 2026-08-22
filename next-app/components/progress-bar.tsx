import { cn } from "@/lib/utils"
import type { StatusTone } from "@/components/status-badge"

/**
 * Progress bar (E338) — a token-toned progress meter for mobile cards / dense
 * table rows (e.g. case/order completion %). `pct` is clamped to [0, 100] so
 * out-of-range input (negative, >100, NaN) never overflows or breaks the
 * `role="progressbar"` contract. Fill color comes from the `tone` token, not
 * an arbitrary color prop — no inline `style=` color.
 */
const FILL_TONES: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  danger: "bg-destructive",
  muted: "bg-muted-foreground",
} as const

export interface ProgressBarProps {
  /** Progress percentage. Values outside [0, 100] (including negative) are clamped. */
  pct: number
  tone?: StatusTone
  /** Show the numeric "N%" label to the right of the bar. */
  showLabel?: boolean
  className?: string
}

function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0
  return Math.min(100, Math.max(0, Math.round(pct)))
}

export function ProgressBar({ pct, tone = "info", showLabel = false, className }: ProgressBarProps) {
  const clamped = clampPct(pct)
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className="bg-muted relative h-1.5 w-full overflow-hidden rounded-full"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out",
            FILL_TONES[tone],
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-muted-foreground w-9 shrink-0 text-right text-xs font-medium tabular-nums">
          {clamped}%
        </span>
      )}
    </div>
  )
}
