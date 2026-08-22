// E339 — banner shown when the viewer cannot mutate this record. Server
// Component — a pure presentational region, no state of its own.
//
// This exemplar's one real readonly case is an admin viewing another user's
// item (IDOR relaxation: admin may READ any item, but the underlying Server
// Actions in actions/items.ts stay ownership-scoped — `WHERE user_id =
// <actor>` — so even an admin cannot edit/delete someone else's item through
// them). A domain with an actual archived/voided status column would reuse
// this exact shape — swap the `reason` copy for the archive reason and it
// still doesn't need a second edit flow (see docs/playbooks/list-detail-edit.md).

import { EyeIcon } from "lucide-react"

export function ReadonlyBanner({ reason }: { reason: string }) {
  return (
    <div className="bg-muted border-border flex items-center gap-2.5 rounded-md border px-4 py-3 text-sm">
      <EyeIcon className="text-muted-foreground size-4 shrink-0" />
      <span>{reason}</span>
    </div>
  )
}
