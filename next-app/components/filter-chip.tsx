"use client"

/**
 * Filter chip (E338) — a one-click status quick-filter row rendered above (or
 * beside) a `<DataTable>` — faster than a dropdown for a small fixed set of
 * states. Harvested from a fork's `filter-chip.tsx`, de-domained: the fork
 * accepted an arbitrary hex `color` and mixed it via inline `style=` +
 * `color-mix()`; this repo's Stop verifier blocks inline style color, so
 * `tone` is a token-mapped enum (reusing the `StatusBadge` vocabulary)
 * instead of an arbitrary color prop.
 *
 * `useFilterChipQuery` syncs the active chip to a URL query param (this epic
 * defines the param name as `status` for the items list) so the selection is
 * deep-linkable — e.g. a stat card elsewhere can link straight to
 * `?status=edited`. Reads its *initial* value from a server-passed prop
 * (matching this repo's existing `?new=1` / `?edit=<id>` convention, see
 * `app/(dashboard)/dashboard/items/page.tsx`) rather than `useSearchParams()`,
 * so there is no client/server hydration mismatch and no Suspense boundary
 * requirement.
 */
import { useCallback, useState, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { StatusTone } from "@/components/status-badge"

const CHIP_ACTIVE_TONES: Record<StatusTone, string> = {
  success: "border-success/40 bg-success/10 text-success hover:bg-success/15 hover:text-success",
  warning: "border-warning/40 bg-warning/10 text-warning hover:bg-warning/15 hover:text-warning",
  info: "border-info/40 bg-info/10 text-info hover:bg-info/15 hover:text-info",
  danger:
    "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive",
  muted: "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
} as const

export interface FilterChipProps {
  active: boolean
  onClick: () => void
  tone?: StatusTone
  children: ReactNode
  className?: string
}

export function FilterChip({ active, onClick, tone = "muted", children, className }: FilterChipProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-7 shrink-0 rounded-full px-3 text-[12.5px] font-semibold",
        active ? CHIP_ACTIVE_TONES[tone] : "text-muted-foreground bg-card",
        className,
      )}
    >
      {children}
    </Button>
  )
}

/** Horizontally-scrollable, non-wrapping container for a row of `<FilterChip>`s. */
export function FilterChipBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Vertical separator between chip groups. */
export function Sep() {
  return <span aria-hidden className="bg-border mx-0.5 h-4 w-px shrink-0" />
}

/**
 * Syncs a single string value to a URL query param, one-way from click →
 * URL (via `router.replace`, no scroll/history spam) — for state that a
 * server component reads back on the next request (deep link). `paramName`
 * is the E338-defined contract other epics (E337) can rely on.
 */
export function useFilterChipQuery(paramName: string, initialValue?: string) {
  const [value, setValueState] = useState(initialValue)
  const router = useRouter()
  const pathname = usePathname()

  const setValue = useCallback(
    (next: string | undefined) => {
      setValueState(next)
      if (typeof window === "undefined") return
      const params = new URLSearchParams(window.location.search)
      if (next) params.set(paramName, next)
      else params.delete(paramName)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [paramName, pathname, router],
  )

  return [value, setValue] as const
}
