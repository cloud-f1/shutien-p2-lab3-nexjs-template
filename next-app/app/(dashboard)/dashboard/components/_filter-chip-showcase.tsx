"use client"

// E338 — interactive showcase for FilterChip/FilterChipBar/Sep. A real onClick
// handler can't cross the Server→Client boundary as an inline prop, so this
// small client component hosts the live demo the /dashboard/components page
// (a Server Component) renders as a leaf.
import { useState } from "react"

import { FilterChip, FilterChipBar, Sep } from "@/components/filter-chip"

export function FilterChipShowcase() {
  const [status, setStatus] = useState<string | undefined>(undefined)

  return (
    <FilterChipBar>
      <FilterChip active={status === undefined} tone="muted" onClick={() => setStatus(undefined)}>
        全部
      </FilterChip>
      <Sep />
      <FilterChip active={status === "edited"} tone="info" onClick={() => setStatus("edited")}>
        已編輯
      </FilterChip>
      <FilterChip active={status === "new"} tone="muted" onClick={() => setStatus("new")}>
        未編輯
      </FilterChip>
    </FilterChipBar>
  )
}
