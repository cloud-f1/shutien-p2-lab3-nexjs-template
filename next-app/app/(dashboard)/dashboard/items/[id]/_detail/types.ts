// E339 — record-detail view-model types, shared by `page.tsx` and every
// `_detail/*` child. Pure types only (no JSX, no imports of `db` or
// server-only modules) so any child can import this file without pulling in
// data-fetching concerns — `page.tsx` is the ONLY place that queries the
// database and assembles these shapes.

export interface ItemDetailVM {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  /** See app/(dashboard)/dashboard/items/_items-table.tsx for the exact "saved again" semantics. */
  edited: boolean
  ownerEmail: string | null
}

export interface ActivityEntryVM {
  id: string
  /** Raw action key (e.g. "item.created") — mapped to Chinese copy in activity-card.tsx. */
  action: string
  actorEmail: string | null
  createdAt: string
}
