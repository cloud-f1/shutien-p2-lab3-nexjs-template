// E339 — record-detail activity card: THIS record's audit entries only.
// Server Component — receives an already-filtered list from page.tsx (which
// calls getAuditLogForTarget("item", id) — a server-side WHERE, not a
// client-side filter of the global log). Never imports `db`.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ActivityEntryVM } from "./types"

const ACTION_LABEL: Record<string, string> = {
  "item.created": "建立項目",
  "item.updated": "編輯項目",
  "item.deleted": "刪除項目",
}

export function ActivityCard({ entries }: { entries: ActivityEntryVM[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">活動紀錄</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">尚無紀錄。</p>
        ) : (
          <ul className="divide-border divide-y">
            {entries.map((entry) => (
              <li key={entry.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{ACTION_LABEL[entry.action] ?? entry.action}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">{entry.createdAt}</span>
                </div>
                {entry.actorEmail && (
                  <p className="text-muted-foreground mt-0.5 text-xs">{entry.actorEmail}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
