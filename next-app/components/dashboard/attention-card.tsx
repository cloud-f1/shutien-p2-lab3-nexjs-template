import { AlertTriangleIcon, ChevronRightIcon } from "lucide-react"

import { Card } from "@/components/ui/card"
import { StatusLight } from "@/components/status-light"
import { cn } from "@/lib/utils"
import type { StatusTone } from "@/components/status-badge"

import { RowLink } from "./row-link"

/**
 * Attention card (E337) — a "needs attention" list, grouped by tone (e.g.
 * overdue vs. stale). Every row deep-links via `RowLink` when it carries an
 * `href`; the whole card shows `emptyText` instead of a blank shell when
 * every group is empty.
 */
export interface AttentionRow {
  id: string
  label: string
  meta?: string
  href?: string
}

export interface AttentionGroup {
  tone: StatusTone
  heading: string
  rows: AttentionRow[]
}

export interface AttentionCardProps {
  title: string
  groups: AttentionGroup[]
  emptyText: string
  className?: string
}

export function AttentionCard({ title, groups, emptyText, className }: AttentionCardProps) {
  const isEmpty = groups.every((g) => g.rows.length === 0)

  return (
    <Card className={cn("gap-0 overflow-hidden rounded-xl p-0", className)}>
      <div className="flex items-center gap-2 border-b px-4.5 py-3.5">
        <AlertTriangleIcon className="text-warning size-[15px]" />
        <span className="text-sm font-bold">{title}</span>
      </div>

      {isEmpty ? (
        <div className="text-muted-foreground py-6 text-center text-sm">{emptyText}</div>
      ) : (
        groups.map((group) =>
          group.rows.length === 0 ? null : (
            <div key={group.heading}>
              <div className="text-muted-foreground bg-muted/30 px-4.5 py-1.5 text-xs font-semibold">
                {group.heading}
              </div>
              {group.rows.map((row) => {
                const content = (
                  <div className="hover:bg-muted/50 flex items-center gap-2.5 border-b px-4.5 py-3 last:border-b-0">
                    <StatusLight tone={group.tone} label={group.heading} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold">{row.label}</div>
                      {row.meta && (
                        <div className="text-muted-foreground truncate text-xs">{row.meta}</div>
                      )}
                    </div>
                    {row.href && (
                      <ChevronRightIcon className="text-muted-foreground/70 size-[15px] shrink-0" />
                    )}
                  </div>
                )
                return row.href ? (
                  <RowLink key={row.id} href={row.href} ariaLabel={row.label}>
                    {content}
                  </RowLink>
                ) : (
                  <div key={row.id}>{content}</div>
                )
              })}
            </div>
          ),
        )
      )}
    </Card>
  )
}
