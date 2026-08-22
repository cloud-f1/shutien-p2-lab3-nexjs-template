import { CalendarIcon } from "lucide-react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

import { RowLink } from "./row-link"

/**
 * Upcoming card (E337) — a time-window list (deadlines, due dates, renewal
 * dates, whatever the caller's domain deep-links into). `overdue` rows get
 * the destructive tone + bold treatment; everything else is a plain caption.
 */
export interface UpcomingRow {
  id: string
  label: string
  dateLabel: string
  overdue?: boolean
  href?: string
}

export interface UpcomingCardProps {
  title: string
  rows: UpcomingRow[]
  emptyText: string
  className?: string
}

export function UpcomingCard({ title, rows, emptyText, className }: UpcomingCardProps) {
  return (
    <Card className={cn("gap-0 rounded-xl px-4.5 py-4", className)}>
      <div className="mb-2.5 flex items-center gap-1.5">
        <CalendarIcon className="text-warning size-[15px]" />
        <span className="text-sm font-bold">{title}</span>
      </div>

      {rows.length === 0 ? (
        <div className="text-muted-foreground/80 py-2 text-sm">{emptyText}</div>
      ) : (
        <div className="flex flex-col">
          {rows.map((row, i) => {
            const content = (
              <div
                className={cn("flex items-center justify-between gap-2.5 py-2", i > 0 && "border-t")}
              >
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{row.label}</span>
                <span
                  className={cn(
                    "shrink-0 text-xs whitespace-nowrap",
                    row.overdue ? "text-destructive font-bold" : "text-muted-foreground",
                  )}
                >
                  {row.dateLabel}
                </span>
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
      )}
    </Card>
  )
}
