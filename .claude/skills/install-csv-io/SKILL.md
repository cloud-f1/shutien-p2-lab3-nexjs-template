---
name: install-csv-io
description: >
  Install the @saas/csv-io module into this Next.js SaaS project. Wires
  lib/csv-io/csv.ts (toCsv/escapeCsvCell export helpers), lib/csv-io/import.ts (a
  generic parseCsv() — upsert-by-key friendly, per-row errors, row cap — generalized
  to any keyed record shape), and components/csv-import-dialog.tsx (a reference bulk-
  import dialog). Reads module.manifest.json and wires the shadcn Dialog/Button/Input
  registry deps. Use after: npx shadcn@latest add @saas/csv-io
user-invocable: true
metadata:
  author: saas-template
  version: "1.0.0"
  epic: E325
---

# Install CSV Import/Export Module

Installs `@saas/csv-io` — CSV export helpers plus a generic, domain-agnostic CSV import
parser and a reference bulk-import dialog.

## Prerequisites

The `@saas` registry is served by the template app at `/r/*`, so installs need
`SAAS_REGISTRY_URL` pointing at a running origin (`http://localhost:3000` locally with
`pnpm dev`, or your deployed domain).

```bash
npx shadcn@latest add @saas/csv-io
```

This installs:
- `lib/csv-io/csv.ts` — `toCsv()` / `escapeCsvCell()`
- `lib/csv-io/import.ts` — `parseCsv()` + `RowError`
- `components/csv-import-dialog.tsx` — reference bulk-import dialog
- `registry/csv-io/module.manifest.json` — the manifest

`registryDependencies` (`dialog`, `button`, `input`) are installed automatically from the
shadcn/ui registry by `npx shadcn@latest add @saas/csv-io` if not already present in this
project (all three ship in this template by default).

## Phase 0 — Pre-flight

```bash
cd next-app
test -f lib/csv-io/csv.ts && test -f lib/csv-io/import.ts && test -f components/csv-import-dialog.tsx && echo "files present"
```

## Phase 1 — Export: `toCsv()` / `escapeCsvCell()`

Call from a route handler (or Server Action returning a data URI) that serves a CSV
download:

```ts
// app/api/items/export/route.ts
import { toCsv } from "@/lib/csv-io/csv"

export async function GET() {
  const items = await getItems()
  const csv = toCsv(
    ["ID", "Name", "Status"],
    items.map((i) => [i.id, i.name, i.status]),
  )
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="items.csv"',
    },
  })
}
```

## Phase 2 — Import: `parseCsv()` inside a Server Action

`parseCsv()` is generic — YOU supply the header-name mapping and the per-row
validator/coercer (typically a Zod `safeParse`). It never touches the database; your
Server Action does the upsert-by-key after parsing:

```ts
// actions/items.ts
"use server"
import { parseCsv } from "@/lib/csv-io/import"
import { itemImportRowSchema } from "@/lib/validations/items"

export async function importItemsCsv(text: string) {
  const { rows, errors, truncated } = parseCsv(text, {
    headerKey: (raw) => {
      const h = raw.trim().toLowerCase()
      if (h === "id") return "id"
      if (h === "name") return "name"
      return null
    },
    requiredKeys: ["id", "name"],
    parseRow: (cells, row) => {
      const parsed = itemImportRowSchema.safeParse(cells)
      if (!parsed.success) {
        return { success: false, reason: parsed.error.issues[0]?.message ?? "Invalid row" }
      }
      return { success: true, data: parsed.data }
    },
    maxRows: 1000,
  })

  let imported = 0
  for (const row of rows) {
    // YOUR upsert-by-key logic — e.g. an ON CONFLICT (id) DO UPDATE, or a
    // select-then-insert/update pair inside a transaction.
    await upsertItemByKey(row)
    imported++
  }

  if (truncated) errors.push({ row: 0, reason: `Only the first ${rows.length} rows were processed (row cap reached).` })
  return { imported, errors }
}
```

Enforce the row cap (`maxRows`) at the call site to match your acceptable request size —
1000 is a reasonable default, not a hard requirement.

## Phase 3 — Wire the reference dialog (or replace it)

`components/csv-import-dialog.tsx` is a **reference starting point** — adapt column
labels/copy per table, or replace it outright if your import UX differs (e.g. a
drag-and-drop zone, a preview table before commit):

```tsx
import { CsvImportDialog } from "@/components/csv-import-dialog"
import { importItemsCsv } from "@/actions/items"

<CsvImportDialog
  title="Import Items"
  description="Upload a CSV with id, name columns."
  onImport={importItemsCsv}
  onDone={() => router.refresh()}
/>
```

## Phase 4 — Verify

```bash
cd next-app
pnpm test           # runs lib/csv-io/csv.test.ts + import.test.ts along with the rest of the suite
pnpm typecheck && pnpm lint
```

## Notes

- **No default row shape.** Unlike a users-specific importer, this module has zero
  built-in field names — `headerKey`/`parseRow` are mandatory per call site.
- **Upsert-by-key is the caller's job.** `parseCsv()` only parses + validates; insert vs.
  update decisions, uniqueness enforcement, and badge/id assignment (if any) belong in
  your Server Action, inside a transaction if the upsert has multiple steps.
- **Blank lines never consume a row number** — error messages stay aligned with what a
  user sees in their spreadsheet app.
