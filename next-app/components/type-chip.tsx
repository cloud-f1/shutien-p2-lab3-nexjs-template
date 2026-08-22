import { cn } from "@/lib/utils"
import type { StatusTone } from "@/components/status-badge"

/**
 * Type chip (E338) — a compact category label (code + name), e.g. for
 * classifying rows in a mobile card or dense table cell. Tone-token only
 * (reuses the `StatusBadge` vocabulary) — the fork this was harvested from
 * accepted an arbitrary hex color and mixed it via inline `style=` +
 * `color-mix()`; this repo's Stop verifier blocks inline style color, so
 * `tone` is a token-mapped enum instead.
 */
const TONE_CLASSES: Record<StatusTone, string> = {
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  info: "text-info bg-info/10",
  danger: "text-destructive bg-destructive/10",
  muted: "text-muted-foreground bg-muted",
} as const

export interface TypeChipProps {
  /** Short code, e.g. "A1" (rendered mono). */
  code: string
  /** Full category name. */
  name: string
  tone?: StatusTone
  className?: string
}

export function TypeChip({ code, name, tone = "info", className }: TypeChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span className="font-mono text-[11px]">{code}</span>
      {name}
    </span>
  )
}
