import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { StatusTone } from "@/components/status-badge"

import { RowLink } from "./row-link"

/**
 * Stat card (E337) — a domain-neutral status KPI tile. Reuses the exact
 * `StatusTone` vocabulary from `status-badge.tsx` (success/warning/info/
 * danger/muted) instead of inventing a second tone scheme.
 *
 * Responsibility boundary: only tint the card background when there is a
 * real positive count AND the tone signals something needing attention
 * (warning/danger) — a healthy/neutral/zero stat never gets painted, so
 * color only ever means "look at this."
 */
const TEXT_TONE: Record<StatusTone, string> = {
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  danger: "text-destructive",
  muted: "text-muted-foreground",
}

const TINT_BG: Record<StatusTone, string> = {
  success: "",
  warning: "bg-warning/8",
  info: "",
  danger: "bg-destructive/8",
  muted: "",
}

export interface StatCardProps {
  tone: StatusTone
  label: string
  value: number
  /** Small caption under the value, e.g. a threshold or scope note. */
  hint?: string
  /** Deep-link target. When present the whole card becomes a `RowLink`. */
  href?: string
  /** Accessible name for the card when `href` is set. Defaults to "`label` `value`". */
  ariaLabel?: string
  className?: string
}

export function StatCard({ tone, label, value, hint, href, ariaLabel, className }: StatCardProps) {
  const tinted = value > 0 && (tone === "warning" || tone === "danger")

  const card = (
    <Card
      className={cn(
        "gap-1 rounded-xl px-4 py-3.5 shadow-xs",
        tinted && TINT_BG[tone],
        href && "transition-colors hover:bg-muted/40",
        className,
      )}
    >
      <div className="text-muted-foreground text-xs font-semibold">{label}</div>
      <div className={cn("text-3xl leading-tight font-black tabular-nums", TEXT_TONE[tone])}>
        {value.toLocaleString()}
      </div>
      {hint && <div className="text-muted-foreground/80 text-[11px]">{hint}</div>}
    </Card>
  )

  if (!href) return card

  return (
    <RowLink href={href} ariaLabel={ariaLabel ?? `${label} ${value}`}>
      {card}
    </RowLink>
  )
}
