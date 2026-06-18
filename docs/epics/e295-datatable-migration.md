# E295 — System Surface DataTable Migration

> Phase 69 · architecture consistency · pattern enforcement
> Status: ⬜ pending

## Problem

Three system panels use hand-rolled `<table>` elements or plain lists, violating the CLAUDE.md architecture rule established by E273: **"List/table views use the reusable `<DataTable>` — never a hand-rolled `<table>` for record lists."**

Affected panels (built before E273 standardized the pattern):
- `_audit-panel.tsx` — contains a raw `<table>`
- `_api-keys-panel.tsx` — plain list, no `<DataTable>`
- `_webhooks-panel.tsx` — plain list, no `<DataTable>`

All three live at `app/(dashboard)/dashboard/system/`.

Fork teams learning from the codebase copy these patterns. The inconsistency teaches a two-pattern codebase when only one pattern should exist.

## Solution

Migrate all three panels to use `components/data-table-generic.tsx` (the `<DataTable>` component shipped with E273). Each migration:
1. Define a `columns` array (same shape as `items/_items-table.tsx` reference)
2. Replace the raw table/list JSX with `<DataTable columns={columns} data={data} />`
3. Remove manual pagination state — `<DataTable>` handles it internally
4. Keep all Server Action wiring (create/revoke/delete buttons) in place via cell renderers

No new features — pure pattern migration.

## Key Files

- `next-app/app/(dashboard)/dashboard/system/_audit-panel.tsx` — migrate to `<DataTable>`
- `next-app/app/(dashboard)/dashboard/system/_api-keys-panel.tsx` — migrate to `<DataTable>`
- `next-app/app/(dashboard)/dashboard/system/_webhooks-panel.tsx` — migrate to `<DataTable>`
- `next-app/components/data-table-generic.tsx` — reference implementation (read-only)
- `next-app/app/(dashboard)/dashboard/items/_items-table.tsx` — column def reference

## Implementation

### Phase 1 — Audit panel
- Define `AuditLogColumn[]` type
- Swap raw `<table>` → `<DataTable columns={auditColumns} data={entries} />`
- Verify filter on `action` + `actor` columns works

### Phase 2 — API keys panel
- Define `ApiKeyColumn[]` type
- Replace list with `<DataTable>`; inline "Revoke" action in cell renderer
- Verify the create-key dialog still opens correctly alongside the table

### Phase 3 — Webhooks panel
- Define `WebhookColumn[]` type
- Replace list with `<DataTable>`; inline "Test" + "Delete" actions in cell renderer
- Run smoke test: all three panels render, filter, paginate correctly

## Acceptance Criteria

- [ ] All three system panels use `<DataTable>` exclusively — no raw `<table>` or `<ul>` lists
- [ ] Filter input, pagination, and page-size selector work in each panel
- [ ] Existing Server Action wiring (revoke key, delete webhook, etc.) still functions
- [ ] `pnpm typecheck` passes with 0 errors
- [ ] `pnpm build` passes

## Out of Scope

- Adding new columns not already present
- Changing the System page layout or tab structure
- Migrating the notifications panel (already uses a card list pattern, not a table)
