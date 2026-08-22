import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Stat card row (E337) — responsive container for `<StatCard>`s: 2 columns
 * on mobile, up to 4 on desktop. `min-w-0` on each slot keeps a long value
 * (e.g. a 6-digit count) from forcing the grid to overflow horizontally.
 */
export function StatCardRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 *:min-w-0 md:grid-cols-4", className)}>
      {children}
    </div>
  )
}
