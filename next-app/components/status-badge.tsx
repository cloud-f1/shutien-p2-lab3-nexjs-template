import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Semantic status badge (E262) — success / warning / info / danger pills using
 * the E259 tokens. Net-new (components/ui/badge.tsx is shadcn-managed). Pair
 * with a live-dot for real-time states.
 */
const TONES = {
  success: "text-success border-success/30 bg-success/10",
  warning: "text-warning border-warning/30 bg-warning/10",
  info: "text-info border-info/30 bg-info/10",
  danger: "text-destructive border-destructive/30 bg-destructive/10",
  muted: "text-muted-foreground border-border bg-transparent",
} as const

/**
 * Shared tone vocabulary (E338) — the status primitives (`status-light`,
 * `progress-bar`, `type-chip`, `role-badge`, `filter-chip`) all key off this
 * same union instead of inventing their own color-naming scheme.
 */
export type StatusTone = keyof typeof TONES

export function StatusBadge({
  tone = "muted",
  dot = false,
  live = false,
  children,
  className,
}: {
  tone?: keyof typeof TONES
  /** Show a leading status dot. */
  dot?: boolean
  /** Animate the dot as a live pulse (success tone). */
  live?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full bg-current",
            live && "live-dot relative",
          )}
        />
      )}
      {children}
    </span>
  )
}
