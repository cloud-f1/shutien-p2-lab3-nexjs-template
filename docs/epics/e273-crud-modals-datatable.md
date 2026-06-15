# E273 — CRUD modals + reusable DataTable (UX convention)

> Phase 63 · UX conventions · domain-neutral
> Status: implemented on `feat/E273-crud-modals-datatable`

## Problem

The Items reference CRUD redirected to standalone pages (`/items/create`, `/items/[id]/edit`)
for create/edit, and rendered a hand-rolled `<table>` with no pagination, filter, or
count. Every new domain copied that shape, so the template taught a dated, full-page-nav
CRUD pattern and an unscalable list view. We want one canonical, modern pattern that all
domains (and the scaffold) follow.

## Solution

1. **CRUD via modals** — create/edit open a shadcn `Dialog`; delete uses a reusable
   `ConfirmDialog`. No page navigation. Server Actions return success (no `redirect`) so the
   modal closes and the list refreshes (`revalidatePath` + `router.refresh()`).
2. **Reusable `<DataTable>`** — one client component (TanStack) providing global filter +
   pagination + page-size selector + row count, used by every record list.
3. **Deep-linkable modals** — `?new=1` opens the create modal; `?edit=<id>` opens the edit
   modal (so other surfaces — e.g. the dashboard overview table — can link into a modal).
4. **Codify it** — `CLAUDE.md` Architecture Rules + the `nextjs-saas-patterns` skill, so the
   spec→implement pipeline and `/athena:domain` generate this pattern by default.

## Key Files

- `next-app/components/data-table-generic.tsx` — reusable `<DataTable>` (NEW)
- `next-app/components/confirm-dialog.tsx` — reusable confirm modal (NEW)
- `next-app/app/(dashboard)/dashboard/items/` — reference impl: `_items-table.tsx`,
  `_item-dialog.tsx`, `_item-form.tsx` (onSuccess), `page.tsx` (`?new`/`?edit`)
- `next-app/actions/items.ts` — create/update return success (no redirect)
- `next-app/components/data-table.tsx`, `nav-main.tsx`, dashboard `page.tsx` — repointed links
- `CLAUDE.md`, `.claude/skills/nextjs-saas-patterns/` — convention codified

## Implementation

- Extracted the TanStack pattern from the dashboard overview table into a generic,
  column-driven `<DataTable>` (filter/paginate/page-size are internal).
- `ConfirmDialog` built on the existing `Dialog` (no new `alert-dialog` dependency).
- Removed `/items/create` + `/items/[id]/edit`; all "新增項目" entry points → `?new=1`;
  dashboard table edit links → `?edit=<id>`.

## Acceptance Criteria

- [x] Create/edit/delete for Items happen in modals; no standalone create/edit routes.
- [x] Items list has a working filter, pagination, and page-size selector + count.
- [x] RBAC unchanged — viewers see no create/edit/delete affordance; actions stay
      `requireEditor()`-gated.
- [x] `?new=1` / `?edit=<id>` open the right modal.
- [x] typecheck + lint + build green; e2e covers the modal CRUD loop + table controls.
- [x] Convention recorded in CLAUDE.md + memory + this epic.

## Out of Scope / Follow-up

- **Server-side pagination** — current `<DataTable>` is client-side (fine for typical
  dashboard lists). Add offset/limit + `where` in the action when a table grows large.
- **`/athena:domain` is still the legacy FastAPI scaffold** — it must be rewritten for the
  Next.js stack to emit modal-CRUD + `<DataTable>` automatically. Until then the convention
  is enforced via CLAUDE.md + the `nextjs-saas-patterns` skill + the `items/` reference.
