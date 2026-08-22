import { cn } from "@/lib/utils"
import type { StatusTone } from "@/components/status-badge"

/**
 * Status light (E338) — a small dot indicator for compact spaces (mobile
 * cards, dense table rows) where a full `<StatusBadge>` pill doesn't fit.
 * Tone-token only (reuses the `StatusBadge` vocabulary) — no arbitrary color
 * props, no inline `style=` color. Always carries an `aria-label` since the
 * dot alone conveys no accessible text.
 */
const DOT_TONES: Record<StatusTone, string> = {
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  danger: "text-destructive",
  muted: "text-muted-foreground",
} as const

export interface StatusLightProps {
  tone?: StatusTone
  /** Accessible description of what the light means, e.g. "運作中". Required. */
  label: string
  /** Animate as a live pulse (e.g. an actively-processing state). */
  pulse?: boolean
  /** Dot diameter in px. */
  size?: number
  className?: string
}

export function StatusLight({
  tone = "muted",
  label,
  pulse = false,
  size = 8,
  className,
}: StatusLightProps) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-block shrink-0 rounded-full bg-current",
        DOT_TONES[tone],
        pulse && "animate-pulse",
        className,
      )}
      style={{ width: size, height: size }}
    />
  )
}
