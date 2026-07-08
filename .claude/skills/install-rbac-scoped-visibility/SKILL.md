---
name: install-rbac-scoped-visibility
description: >
  Install the @saas/rbac-scoped-visibility module into this Next.js SaaS project.
  Wires assignment-scoped row-level visibility: lib/rbac-scoped-visibility/visibility.ts
  (a pure canSeeAssignedRow()/filterAssignedRows() predicate — a role either sees
  everything or only rows it's assigned to) and lib/rbac-scoped-visibility/schema.ts
  (a generic resource_assignees M:N table). Documents composing the predicate with the
  defineAction() authorize hook (E323) and the live-role read (getLiveRole()). Use
  after: npx shadcn@latest add @saas/rbac-scoped-visibility
user-invocable: true
metadata:
  author: saas-template
  version: "1.0.0"
  epic: E325
---

# Install RBAC Scoped Visibility Module

Installs `@saas/rbac-scoped-visibility` — assignment-scoped row-level visibility. A role
that has "full visibility" (an admin/manager tier) sees every row; every other role sees
only rows it is explicitly assigned to, via a generic M:N assignment table.

## Prerequisites

The `@saas` registry is served by the template app at `/r/*`, so installs need
`SAAS_REGISTRY_URL` pointing at a running origin: `http://localhost:3000` (with
`pnpm dev` running) locally, or your deployed domain.

```bash
npx shadcn@latest add @saas/rbac-scoped-visibility
```

This installs:
- `lib/rbac-scoped-visibility/visibility.ts` — `canSeeAssignedRow()` / `filterAssignedRows()`
- `lib/rbac-scoped-visibility/schema.ts` — the `resource_assignees` Drizzle table
- `registry/rbac-scoped-visibility/module.manifest.json` — the manifest

No env vars, no npm dependencies (uses the template's existing `drizzle-orm` + `@/lib/schema`).

## Phase 0 — Pre-flight

```bash
cd next-app
test -f lib/rbac-scoped-visibility/visibility.ts && test -f lib/rbac-scoped-visibility/schema.ts && echo "files present"
```

## Phase 1 — Wire the schema into the Drizzle barrel (REQUIRED before migrating)

drizzle-kit reads `lib/schema` (see `drizzle.config.ts`) and unions everything re-exported
there. Add the module's table to that union so a migration is generated:

```ts
// lib/schema/index.ts — add this line
export * from "./rbac-scoped-visibility/schema"
```

Without this step `pnpm db:generate` will NOT emit a migration for `resource_assignees`.

> `resource_assignees` uses generic `resourceType` + `resourceId` columns (mirrors the
> `@saas/audit-log` module's `targetType`/`targetId` convention) rather than a hardcoded
> FK, so the fragment installs standalone. If you only ever scope ONE table, consider
> swapping `resourceId`'s `text()` column for a real FK to that table.

## Phase 2 — Generate + apply the migration

```bash
cd next-app
pnpm db:generate   # emits drizzle/NNNN_*.sql creating resource_assignees
pnpm db:migrate    # applies it
```

## Phase 3 — Wire `hasFullVisibility` to your permission matrix

`canSeeAssignedRow()` takes a `hasFullVisibility` predicate — it does not assume any
particular role model:

```ts
import { canSeeAssignedRow } from "@/lib/rbac-scoped-visibility/visibility"

const hasFullVisibility = (role: Role | null | undefined) => role === "admin"
// or reuse an existing helper: import { isAdmin } from "@/lib/is-admin"
```

## Phase 4 — Compose with `defineAction()`'s `authorize` hook (E323, recommended)

`defineAction()`'s `authorize` hook is the natural home for a row-scoping check — it runs
after the role-level `allow` gate passes and before the handler, and its `ctx.role` is
already the **live** DB role (`getLiveRole()`), matching this module's fail-closed
contract:

```ts
import { defineAction } from "@/lib/define-action"
import { canSeeAssignedRow } from "@/lib/rbac-scoped-visibility/visibility"

export const updateItemAction = defineAction({
  allow: (role) => role !== "viewer",
  schema: updateItemSchema,
  authorize: async (input, ctx) => {
    const assigneeIds = await getAssigneeIds(input.id) // your own query against resource_assignees
    const ok = canSeeAssignedRow({ id: ctx.actorId, role: ctx.role }, assigneeIds, {
      hasFullVisibility: (role) => role === "admin",
    })
    if (!ok) return { error: "You do not have access to this item." }
    return { ok: undefined }
  },
  handler: async (input, ctx) => {
    /* ... */
  },
})
```

For a list/query, prefer scoping the DB query itself (a join against `resource_assignees`
filtered to `userId = ctx.actorId` when the role lacks full visibility) over loading every
row and filtering in memory with `filterAssignedRows()` — the in-memory helper is for
small, already-loaded row sets.

## Phase 5 — Verify

```bash
cd next-app
pnpm typecheck && pnpm lint
pnpm test    # runs the module's own visibility.test.ts along with the rest of the suite
```

## Notes

- **Fail-closed.** No `user`/`user.id`, or a scoped role with no `assigneeIds`, always
  resolves to `false` — never throws, never defaults to visible.
- **Live role only.** Always pass a freshly-read role (e.g. `getLiveRole()`) into
  `hasFullVisibility` — never the JWT-session-cached role, which can lag a demotion.
- **This module ships no query helper.** It assumes you already have (or will write) a
  query against `resource_assignees` to fetch `assigneeIds` for a given `resourceType` +
  `resourceId` — that query is domain-specific and intentionally left to the caller.
