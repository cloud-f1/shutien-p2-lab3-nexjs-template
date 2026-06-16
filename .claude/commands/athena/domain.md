---
description: "(ops) Scaffold a new domain → Drizzle table + Zod validation + Server Actions + dashboard page + unit test. Usage: `NAME=x`."
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

Drive the existing Next.js domain scaffold. This command does **not** generate
OpenAPI specs, SQLAlchemy models, Alembic migrations, Axios services, React
Query hooks, or MSW handlers — that stack was fully removed. A "domain" here is
the Next.js App Router pattern: a Drizzle table, shared Zod validation, Server
Actions, and a dashboard page using modals + `<DataTable>`.

Read the canonical reference domain before scaffolding — the **items** domain is
the exact pattern every new domain mirrors:

- `next-app/lib/schema/items.ts` — Drizzle `pgTable` (user-owned, ownership FK + index)
- `next-app/lib/schema/index.ts` — the barrel that drizzle-kit reads (`export * from "./<domain>"`)
- `next-app/lib/validations/items.ts` — shared Zod create/update schemas + inferred types
- `next-app/actions/items.ts` — `"use server"` Server Actions (RBAC-gated, ownership-scoped, `revalidatePath`)
- `next-app/app/(dashboard)/dashboard/items/` — `page.tsx` (Server Component) + `_items-table.tsx` + `_item-dialog.tsx` + `_item-form.tsx` (CRUD via modals)

Also read the scaffold entry point and naming templates:

- `scripts/new-domain.sh` — the generator script
- `docs/templates/domain/domain.config.yaml` and `docs/templates/domain/agent.md.tmpl`

Parse the user's input: $ARGUMENTS

The first argument (or `NAME=x`) is the domain name (singular, lowercase
letters/underscores, e.g. `note`, `blog_post`). Optional `--fields` provides
comma-separated field definitions (e.g. `title:string,body:text`). Optional
`--agent` generates a domain expert agent alongside the CRUD code.

If `--fields` is omitted, use the default field: `title` (string, required) —
matching the items domain.

## Naming Derivation

`scripts/new-domain.sh` derives these variants from the input name (mirror them
when you edit the barrel / page yourself):

| Variable | Rule | Example (input: `blog_post`) |
|----------|------|------------------------------|
| `{{SNAKE}}` | snake_case singular | `blog_post` |
| `{{SNAKE_PLURAL}}` | snake_case plural | `blog_posts` |
| `{{PASCAL}}` | PascalCase singular | `BlogPost` |
| `{{PASCAL_PLURAL}}` | PascalCase plural | `BlogPosts` |
| `{{CAMEL}}` | camelCase singular | `blogPost` |
| `{{CAMEL_PLURAL}}` | camelCase plural | `blogPosts` |
| `{{KEBAB_PLURAL}}` | kebab-case plural | `blog-posts` |
| `{{UPPER_SNAKE}}` | UPPER_SNAKE_CASE | `BLOG_POST` |

### Pluralization rules:
- Ends with `s`, `x`, `z`, `sh`, `ch` → add `es`
- Ends with `y` (preceded by consonant) → drop `y`, add `ies`
- Otherwise → add `s`

## Field Type Mapping

Map each `--fields` entry to a Drizzle column + a Zod rule. Table names are
plural snake_case; the table is user-owned (FK to `usersTable` with an index)
exactly like `lib/schema/items.ts`.

| Short | TypeScript | Drizzle column | Zod |
|-------|------------|----------------|-----|
| string | `string` | `text("col").notNull()` | `z.string().min(1).max(255)` |
| text | `string \| null` | `text("col")` | `z.string().max(2000).optional()` |
| int | `number` | `integer("col")` | `z.coerce.number().int()` |
| float | `number` | `doublePrecision("col")` | `z.coerce.number()` |
| bool | `boolean` | `boolean("col").notNull().default(false)` | `z.coerce.boolean()` |
| date | `Date` | `timestamp("col", { mode: "date" })` | `z.coerce.date()` |
| decimal | `string` | `numeric("col", { precision: 12, scale: 2 })` | `z.coerce.number()` |
| uuid (owner) | `string` | `uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" })` | (server-set, not user input) |

Every table also gets `id: uuid().primaryKey().defaultRandom()`,
`createdAt`/`updatedAt` `timestamp(..., { mode: "date" }).notNull().defaultNow()`,
and an `index("<plural>_user_id_idx").on(t.userId)`.

## Workflow

### Step 1 — Parse input
Parse the domain name and fields. Derive all naming variants (table above).

### Step 2 — Run the scaffold script
Execute:

```bash
./scripts/new-domain.sh <NAME>
```

This generates the domain skeleton. **Read its actual output** and reconcile to
the Next.js layout below — do not assume the script's printed file list is
correct (it predates the migration in places). The authoritative target shape
is the **items** domain. The files a Next.js domain must end with are:

- `next-app/lib/schema/<plural>.ts` — Drizzle `pgTable` (model on `lib/schema/items.ts`)
- `next-app/lib/validations/<plural>.ts` — Zod `create<Pascal>Schema` / `update<Pascal>Schema` + inferred types
- `next-app/actions/<plural>.ts` — `"use server"` Server Actions: `create`, `update`, `delete` — each calls `requireEditor()` (or `requireAuth()`/`requireAdmin()` as appropriate from `@/lib/permissions`), scopes every query by `userId`, and ends success with `revalidatePath(...)` returning `null` (no `redirect` — modals close on success)
- `next-app/app/(dashboard)/dashboard/<plural>/page.tsx` — async Server Component that `requireAuth()`s, fetches via Drizzle scoped to `session.user.id`, and renders `<DataTable>` + modal affordances
- `next-app/app/(dashboard)/dashboard/<plural>/_<singular>-table.tsx` + `_<singular>-dialog.tsx` + `_<singular>-form.tsx` — the client CRUD-via-modal trio (copy + rename from the items domain)
- `next-app/lib/validations/<plural>.test.ts` — a Vitest unit test for the pure Zod validation logic (model on `lib/validations/auth.test.ts`)

If the script writes anything under `server/`, `client/src/`, or as a `.css`
file, that is stale FastAPI/Vite output — delete it and produce the Next.js
files above by copying + renaming from the items domain instead.

### Step 3 — Register the table in the schema barrel
Append `export * from "./<plural>"` to `next-app/lib/schema/index.ts` so
drizzle-kit unions the new table (it reads the barrel — see `drizzle.config.ts`).

### Step 4 — Generate + apply the migration
From `next-app/`:

```bash
pnpm db:generate     # drizzle-kit generate → drizzle/migrations/*.sql + meta/_journal.json
pnpm db:migrate      # apply to the database
```

There is no Alembic and no autogenerate-vs-handwrite split — Drizzle diffs the
schema against the journal and writes the SQL.

### Step 5 — Write / confirm the dashboard page + modals
Ensure `app/(dashboard)/dashboard/<plural>/page.tsx` and its `_*` client
components follow the items pattern: list via `<DataTable>`
(`components/data-table-generic.tsx`), create/edit via a shadcn `Dialog`,
delete via `components/confirm-dialog.tsx`. Deep-link modals with `?new=1` /
`?edit=<id>`. The route auto-registers (filesystem routing) — there is **no**
`routeMap.ts` / `App.tsx` edit. Add a sidebar link in
`components/app-sidebar.tsx` if the domain should appear in nav.

### Step 6 — Verify
From `next-app/`:

```bash
pnpm typecheck && pnpm lint && pnpm test
```

`pnpm test` runs the Vitest unit suite (including the new
`lib/validations/<plural>.test.ts`). Optionally add a Playwright e2e spec under
`next-app/e2e/<plural>.spec.ts` (model on `e2e/items-crud.spec.ts`) and run
`pnpm test:e2e`. Output the full list of files created / edited.

### Step 7 (Optional) — Generate Domain Agent
If `--agent` is provided:
1. Read `docs/templates/domain/agent.md.tmpl`
2. Replace variables (`{{SNAKE}}`, `{{SNAKE_PLURAL}}`, `{{PASCAL}}`, `{{PASCAL_PLURAL}}`)
3. Write to `.claude/agents/<singular>.md`
4. Create `docs/context/<singular>-log.md` with header:
   ```markdown
   # {{PASCAL}} — 諮詢紀錄

   > 由 @{{SNAKE}} 自動維護。記錄所有領域諮詢的問題、建議與參考來源。
   ```
5. Report: "Created @<singular> domain agent"

## Important Rules

- **Mirror the items domain.** `lib/schema/items.ts`, `lib/validations/items.ts`,
  `actions/items.ts`, and `app/(dashboard)/dashboard/items/` are the canonical
  shape every new domain copies.
- **Drizzle table is user-owned** — `id` UUID PK, `user_id` FK to `usersTable`
  with `onDelete: "cascade"`, a `user_id` index, and `created_at`/`updated_at`
  timestamps.
- **Register the table in the barrel** — `export * from "./<plural>"` in
  `lib/schema/index.ts`; drizzle-kit reads the barrel, not individual files.
- **Server Actions are RBAC-gated and ownership-scoped** — call `requireEditor`
  / `requireAuth` / `requireAdmin` from `@/lib/permissions`, scope every
  query by `userId`, and check `result.count === 0` to surface
  not-found/forbidden instead of silently succeeding.
- **Mutations return success (no `redirect`)** — actions `revalidatePath` and
  return `null` so the modal closes and the list refreshes via
  `router.refresh()`. CRUD uses modals, never page redirects.
- **Filesystem routing** — the dashboard page file IS the route; no
  `routeMap.ts` / `App.tsx`. Add a nav link in `components/app-sidebar.tsx` if
  desired.
- **Migrations via Drizzle** — `pnpm db:generate` then `pnpm db:migrate`. No
  Alembic, no autogenerate.
- **No OpenAPI / SQLAlchemy / Pydantic / Axios / MSW / pytest** — those belong
  to the removed FastAPI+Vite stack. If the scaffold script emits them, treat
  the output as stale and produce the Next.js equivalents from the items domain.
- When `--agent` is used, generate from `docs/templates/domain/agent.md.tmpl`
  (see Step 7).
