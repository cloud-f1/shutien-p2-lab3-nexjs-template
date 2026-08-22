// E339 — record-detail side card: attribute summary (owner / timestamps / id).
// Server Component (no interactivity needed) — receives its view-model as
// props only; never imports `db`.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ItemDetailVM } from "./types"

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("truncate text-right", mono && "font-mono text-xs")}>{value}</span>
    </div>
  )
}

export function SideCard({ item }: { item: ItemDetailVM }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">屬性</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Row label="擁有者" value={item.ownerEmail ?? "—"} />
        <Row label="建立時間" value={item.createdAt} />
        <Row label="更新時間" value={item.updatedAt} />
        <Row label="ID" value={item.id} mono />
      </CardContent>
    </Card>
  )
}
