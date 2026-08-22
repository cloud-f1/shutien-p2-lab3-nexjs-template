import { ActivityIcon } from "lucide-react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { AuditEntry } from "@/lib/audit"

/**
 * Activity card (E337) — a system activity feed reading `lib/audit.ts`'s
 * `AuditEntry[]` directly. `AuditEntry` is generic infrastructure (actor,
 * action, target, timestamp) shared by every domain's audit trail, not a
 * domain module — importing it does not violate the kit's domain-neutrality
 * rule.
 *
 * Target label prefers a human-readable `metadata.label` (a domain caller can
 * stash one when it calls `logAudit`); falling back to a short
 * `targetType:targetId` when no label was recorded.
 */
function targetLabel(entry: AuditEntry): string | null {
  const metadata = entry.metadata
  if (metadata && typeof metadata === "object" && "label" in metadata) {
    const label = (metadata as Record<string, unknown>).label
    if (typeof label === "string" && label.length > 0) return label
  }
  if (entry.targetType && entry.targetId) {
    return `${entry.targetType}:${entry.targetId.slice(0, 8)}`
  }
  return entry.targetType ?? null
}

/** Relative "N 分鐘前" / "N 小時前" / "N 天前" formatting, falling back to a date once it's stale. */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = Math.max(0, now.getTime() - date.getTime())
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return "剛剛"
  if (diffMin < 60) return `${diffMin} 分鐘前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 小時前`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 30) return `${diffDay} 天前`
  return date.toLocaleDateString("zh-Hant")
}

export interface ActivityCardProps {
  title: string
  entries: AuditEntry[]
  emptyText: string
  className?: string
}

export function ActivityCard({ title, entries, emptyText, className }: ActivityCardProps) {
  return (
    <Card className={cn("gap-0 rounded-xl px-4 py-4", className)}>
      <div className="mb-3.5 flex items-center gap-1.5">
        <ActivityIcon className="text-primary size-[15px]" />
        <span className="text-sm font-bold">{title}</span>
      </div>

      {entries.length === 0 ? (
        <div className="text-muted-foreground/80 py-2 text-sm">{emptyText}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => {
            const target = targetLabel(entry)
            return (
              <div key={entry.id} className="flex items-start justify-between gap-2.5">
                <div className="min-w-0 text-[12.5px] leading-snug">
                  <strong>{entry.actorEmail ?? "系統"}</strong>
                  <span className="text-muted-foreground">・{entry.action}</span>
                  {target && <span className="text-primary font-mono text-[11px]"> {target}</span>}
                </div>
                <span className="text-muted-foreground/80 shrink-0 text-[11px] whitespace-nowrap">
                  {formatRelativeTime(entry.createdAt)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
