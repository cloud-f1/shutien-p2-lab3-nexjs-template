---
name: nextjs-saas-patterns
description: >-
  Hard-won, non-obvious patterns and gotchas for THIS Next.js 16 + Auth.js v5 + Drizzle + shadcn
  SaaS template — the ones that already caused real, hours-costing bugs. Use this skill whenever
  you touch authentication, login/register, sessions, RBAC / roles / permissions, shadcn blocks
  (login-01 / sidebar-01 / dashboard-01 etc.), the database seed, Docker / docker-compose, or
  繁體中文 (i18n) in this repo — even if the request doesn't name these explicitly (e.g. "add a
  role", "wire up the dashboard", "why is login bouncing back", "run it in Docker"). Reading this
  first prevents re-discovering the same failures the hard way.
---

# Next.js SaaS Template — Patterns & Gotchas

This template is Next.js 16 (App Router) + React 19 + Auth.js v5 + Drizzle (postgres-js) + shadcn/ui,
fully 繁體中文. The rules below are not style preferences — each one traces to a concrete bug that
shipped green-looking but was broken. Trust them before "simplifying" back to the obvious approach.

## 1. Auth.js v5 Credentials **requires JWT sessions** (not database sessions)

The single most expensive bug in this repo's history: with the `DrizzleAdapter`, Auth.js defaults to
**database** sessions. The **Credentials** provider *cannot create a database session* — so a
credentials login POSTs `303` (looks like success), but `auth()` returns `null` on the very next
request → the dashboard crashes → the user bounces back to `/login`. It looks like "login doesn't
work" with no obvious cause.

**Always** configure JWT sessions when Credentials is in play:

```ts
// lib/auth.ts
session: { strategy: "jwt" },
callbacks: {
  async jwt({ token, user, trigger, session }) {
    if (user) { token.id = user.id; token.role = user.role ?? "viewer" }
    if (trigger === "update" && session) { /* merge name/picture for profile edits */ }
    return token
  },
  session({ session, token }) {
    if (session.user) { session.user.id = token.id; session.user.role = token.role ?? "viewer" }
    return session
  },
}
```

**Corollary — the smoke test that lied:** a probe that checks status codes / redirects ("does /login
return 200, does /dashboard redirect") will report all-green while login is totally broken, because it
never actually signs in and lands on the dashboard. Only a real end-to-end e2e (login → dashboard →
perform an action) catches this. See `athena-engineering-practices` → "must actually run it".

## 2. RBAC: role lives in the JWT, so **re-read it from the DB for authorization**

Roles are a `pgEnum("role", ["admin","editor","viewer"])` column (default `viewer`). The tiers:
admin = everything + `/dashboard/admin`; editor = item create/edit/delete; viewer = read-only.

The JWT snapshots `role` at sign-in. So if an admin **demotes** a user, that user's existing token
still says the old role until they re-login — a real privilege gap. Therefore the **server-side
guards re-read the live role from the DB**, they do not trust `session.user.role`:

```ts
// lib/permissions.ts — requireAdmin()/requireEditor() call getLiveRole() (DB lookup), not session.user.role
```

- `lib/is-admin.ts` is the **client-safe** split: pure `isAdmin(role)` / `canEdit(role)` with **zero
  imports** so it never drags `lib/auth.ts` (Node-only: postgres, DrizzleAdapter) into a client bundle.
- `lib/permissions.ts` (server-only) has `requireAuth`, `requireAdmin`, `requireEditor` and re-exports
  the pure helpers.
- **Defense in depth:** every item-mutating Server Action calls `requireEditor()` and every admin
  action calls `requireADMIN()` as its *first* line. Server Actions are public POST endpoints — UI
  hiding (`canEdit`) is not a security control. Also validate enum inputs at runtime (`VALID_ROLES`
  allowlist) since TS types are erased.

## 3. Edge middleware (`proxy.ts`) is authentication-only

Next.js 16 renamed `middleware.ts` → **`proxy.ts`**, which runs on the Edge runtime. It must import
only `auth.config.ts` (no adapter, no Node-only code) — importing `lib/auth.ts` breaks at runtime.
Keep the middleware to a coarse "logged in?" gate; do **authorization** (`role` checks) server-side in
`requireAdmin`/`requireEditor`, because DB-session tokens don't carry `role` reliably at the edge.
Also set `trustHost: true` in `auth.config.ts` (non-standard ports / reverse proxies throw
`UntrustedHost` otherwise).

## 4. shadcn blocks integration

`npx shadcn@latest add login-01 signup-01 sidebar-01 dashboard-01` is the fast path for UI, but:

- **Route conflicts:** blocks write `app/login/`, `app/signup/`, `app/dashboard/` (no route group) —
  these collide with our `app/(auth)/login/` and `app/(dashboard)/dashboard/`. After adding a block,
  **delete its standalone route + page**, keep only the components, and merge the look into our
  route-group pages.
- **`sidebar-01` needs a `TooltipProvider`.** `SidebarMenuButton`'s `tooltip` prop renders a `<Tooltip>`,
  but the current `SidebarProvider` does *not* include a `TooltipProvider`. Without one, **every
  dashboard page throws server-side** (`Tooltip must be used within TooltipProvider`) and 404/500s
  cascade. Wrap the dashboard subtree (or root) in `<TooltipProvider>`.
- **`CardTitle` is a `<div data-slot="card-title">`, not a heading** — don't assert on `h1/h2` for
  block titles in tests; use `getByText(...)` or `[data-slot="card-title"]`.
- **RHF + Server Action submit:** call the `useActionState` dispatch inside a transition —
  `startTransition(() => formAction(fd))` — and add `noValidate` to the `<form>` so Zod (not the
  browser's native validation) is the single validation source. The old `formRef.current.requestSubmit()`
  pattern trips React 19's `react-hooks/refs` lint and double-submits.
- **`db.$count(table, where)` returns a `Promise<number>`** — use it directly. Wrapping it in
  `.select({count}).from(table)` returns one row per row and yields `[]` (→ destructure crash) for
  users with zero rows. With postgres-js, a mutation's affected-row count is `.count`, **not**
  `.rowCount`.

## 5. Database: migrations, seed, and the `expires_at` cast

- Drizzle migrations live in `drizzle/migrations/*.sql` + the `meta/_journal.json` index. When you
  hand-write or fix a migration, **update the journal too** or `drizzle-kit migrate` won't apply it.
- **Enum changes** can't drop values in place — recreate the type: drop default → cast column to
  `text` → drop old enum → create new enum → cast back with a `USING CASE ...` mapping → restore
  default. Verify on both a populated dev DB *and* a fresh DB.
- An `ALTER COLUMN ... SET DATA TYPE integer` from a `timestamp` needs an explicit
  `USING extract(epoch from "expires_at")::integer` — Postgres won't auto-cast (error 42804) and the
  migrate crashes on a fresh DB.
- **Seed is dev-only:** `drizzle/seed.ts` must refuse to run when `NODE_ENV==='production'` (unless an
  explicit `ALLOW_SEED`), and must never ship static admin passwords to a prod DB. Demo accounts:
  `admin@/editor@/viewer@example.com`.

## 6. Docker (local run)

`next.config.ts` `output: "standalone"` + a multi-stage Dockerfile (`deps → builder → runner`). Key
points: `next build` eagerly evaluates `lib/db.ts` (throws if `DATABASE_URL` unset) during page-data
collection, so set **build-time placeholder** `DATABASE_URL`/`AUTH_SECRET` in the builder stage (the
postgres client connects lazily — no DB is contacted at build). Run migrate+seed via a one-shot
compose service built from the `builder` target (it has drizzle-kit + tsx). Set `AUTH_TRUST_HOST=true`
and a fixed `AUTH_SECRET` for the local stack, and point the dev DB and the compose DB at the **same**
postgres (same creds/port) so there's one database, not duplicates. `docker compose down
--remove-orphans` clears leftover containers from a prior compose version.

## 7. i18n (繁體中文)

UI text, Zod messages, Server-Action error strings, and `metadata.title` are all zh-Hant; `<html
lang="zh-Hant">`. When translating, **only change visible text** — never input `name=` attributes,
routes, role enum *values* (translate display labels only), or variable names. Keep a shared glossary
so parallel work stays consistent, and **update the e2e + unit assertions** that match on English
strings (they break otherwise). Build-time `NEXT_PUBLIC_*` flags (e.g. a demo-login gate) are baked at
build — pass them as Docker `--build-arg` to surface in the standalone image, and default them off so
prod builds tree-shake the gated code (and any literals) out.

## `defineAction()` factory — the Server Action pipeline (E323)

`next-app/lib/define-action.ts` collapses the boilerplate every mutating Server Action repeats
— guard → validate → business → audit → revalidate — into a single pipeline. `defineAction(cfg)`
returns `(rawInput) => ActionResult<O>`; on each call it runs, in order:

1. **guard** — login check + the **live role**, re-read from the DB via `getLiveRole(actorId)`
   (never `session.user.role` — see §2 above, the JWT snapshots role at sign-in). If
   `getLiveRole` resolves **no role at all** (e.g. the user row was deleted after the session
   was issued), the factory rejects the same as "not logged in" — a handler never runs with an
   `undefined`/null role. `cfg.allow?: (role) => boolean` is the optional role-level gate on
   top of that (omit = login-only); `cfg.denyMessage` customizes the rejection text.
2. **validate** — `cfg.schema.safeParse(raw)` (a shared Zod schema, ideally the same one RHF
   uses client-side); the first issue's message becomes the returned error.
3. **authorize** (optional) — `cfg.authorize(input, ctx)`, the **resource-level** hook for
   "has the role flag, but only on rows it should touch" cases (ownership, assignment-scoping —
   the kind of check a single role flag can't express). Runs after `allow` passes and input
   validates. Return `{ error }` to reject (handler + audit never run); return `{ ok: resource }`
   to hand the already-loaded row into the handler (saves a re-query). This is also where an
   assignment-scoped completion check belongs — see the security-audit skill's
   "authorization-flag vs ownership confusion" entry — kept structurally separate from `allow`.
4. **handler** — business logic; return `{ error }` to fail cleanly (no audit, no revalidate),
   or `{ data, audit }` on success. `audit` is type-forced to be present (`null` to explicitly
   exempt) — the factory's guarantee that logging can't be silently forgotten.
5. **audit** — if `audit` is non-null, `logAudit(audit)` runs automatically.
6. **revalidate** — every path in `cfg.revalidate` gets `revalidatePath()`'d.

Real usage — the reference migration in `actions/items.ts` (`deleteItemAction`, wrapped by the
thin `deleteItem(id)` to preserve its existing call signature):

```ts
const deleteItemAction = defineAction({
  allow: canEdit, // role-level: viewers are read-only; editors + admins may delete
  schema: z.object({ id: z.string().min(1) }),
  revalidate: ["/dashboard", "/dashboard/items"],
  handler: async ({ id }, ctx) => {
    const result = await db
      .delete(itemsTable)
      .where(and(eq(itemsTable.id, id), eq(itemsTable.userId, ctx.actorId)))
    if (result.count === 0) {
      return { error: "找不到項目，或您沒有權限刪除。" } // same message either way — no leak
    }
    return {
      data: {},
      audit: { actorId: ctx.actorId, action: "item.deleted", targetType: "item", targetId: id },
    }
  },
})
```

To see the optional `authorize` resource hook in the same domain, imagine splitting the
ownership check out of the handler's `WHERE` and into a dedicated step (the factory supports
this today, even though the reference migration above inlines it in the handler for simplicity):

```ts
defineAction({
  allow: canEdit,
  schema: z.object({ id: z.string().min(1) }),
  authorize: async (input, ctx) => {
    const item = await getItemById(input.id)
    if (!item) return { error: "找不到項目。" }
    return item.userId === ctx.actorId ? { ok: item } : { error: "找不到項目，或您沒有權限刪除。" }
  },
  handler: async (input, ctx, item) => { /* item is the authorize hook's `ok` value */ },
})
```

Not every domain fits a single role flag — `authorize` exists for the case where
"can do X, but only on rows I'm scoped to" can't be expressed as one boolean; keep a
hand-written guard only when even the resource hook can't express the rule.

## CRUD modals + list tables (E273 — project convention)

Record CRUD in this template is **modal-based, never page-redirect**, and lists use a
**reusable DataTable**. Follow this when adding any domain (it's a CLAUDE.md Architecture Rule):

- **Create/edit → shadcn `Dialog`.** The form takes an `onSuccess` callback; the dialog closes
  + `router.refresh()` on success. There is **no** `/x/create` or `/x/[id]/edit` page.
- **Server Actions return success, do NOT `redirect()`.** A `redirect` inside a modal navigates
  away. Return `null` (success) / `{ error }` (fail); the list refreshes via `revalidatePath`
  in the action + `router.refresh()` in the dialog.
- **Delete → `components/confirm-dialog.tsx`** (built on `Dialog`; no `alert-dialog` dep).
- **Lists → `components/data-table-generic.tsx` `<DataTable columns={} data={} />`** — global
  filter + pagination + page-size + count are built in. Don't hand-roll `<table>` for records.
- **Deep-link modals** with query params: `?new=1` (create), `?edit=<id>` (edit) — the list page
  reads them and opens the right modal on mount. Other surfaces link in (e.g. dashboard table).
- **Reference impl:** `app/(dashboard)/dashboard/items/` (`_items-table.tsx`, `_item-dialog.tsx`,
  `_item-form.tsx`, `page.tsx`) + `actions/items.ts`.

## Architecture rules learned the hard way

- **Component size / composition:** keep files focused — split by concern before a file
  balloons. A detail-view component or an action file that grows past a few hundred lines
  (e.g. a single `_item-detail.tsx` absorbing every region of a page, or `actions/items.ts`
  absorbing create/update/delete/export/webhooks all at once) becomes a review and merge
  hazard: every unrelated change touches the same file, PRs collide, and diffs stop being
  reviewable. Split big detail views into region sub-components and split action files by
  concern (e.g. `actions/items.ts` / `actions/items-export.ts` / `actions/items-webhooks.ts`)
  behind a test safety net, before the file becomes unreviewable rather than after.
- **Server/Client islands:** default to Server Components (this repo's Architecture Rule);
  push `"use client"` to the **leaf** component that actually needs state/handlers/browser
  APIs, not the whole page or a wide subtree. An over-clientized view ships a bigger JS
  bundle and loses RSC's server-only data-fetching benefits for no reason.
- **Client reuses the server's Zod schema:** for live client-side validation (RHF, inline
  field checks), call the **same** shared schema from `lib/validations/*.ts`
  (`schema.safeParse(...)` or RHF's `zodResolver(schema)`) — never hand-roll a parallel
  regex or ad-hoc check that mirrors the rule (e.g. a client-only `titleValid` copy of
  `itemTitleSchema`'s rule, the single title validator `createItemSchema` and
  `updateItemSchema` both share — see `lib/validations/items.ts`, E352). A duplicated
  rule drifts the moment either side changes, and the server's copy is the only one
  that's actually enforced.

## Quick file map

| Concern | Files |
|---|---|
| CRUD pattern | `components/data-table-generic.tsx`, `components/confirm-dialog.tsx`, `app/(dashboard)/dashboard/items/*` |
| Auth config | `lib/auth.ts` (full, Node), `auth.config.ts` (Edge), `proxy.ts`, `auth.d.ts` |
| RBAC | `lib/permissions.ts` (server), `lib/is-admin.ts` (client-safe), `lib/schema.ts` (roleEnum) |
| Validation | `lib/validations/*.ts` (shared Zod for RHF client + Server Action server) |
| Actions | `lib/define-action.ts` (factory, E323), `actions/{auth,user,admin,items}.ts` |
| Tests | `lib/**/*.test.ts` (Vitest unit), `e2e/*.spec.ts` (Playwright) |
| Infra | `Dockerfile`, `../docker-compose.yml`, `drizzle/{seed.ts,migrations/}` |
