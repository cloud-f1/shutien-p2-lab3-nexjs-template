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

## Quick file map

| Concern | Files |
|---|---|
| Auth config | `lib/auth.ts` (full, Node), `auth.config.ts` (Edge), `proxy.ts`, `auth.d.ts` |
| RBAC | `lib/permissions.ts` (server), `lib/is-admin.ts` (client-safe), `lib/schema.ts` (roleEnum) |
| Validation | `lib/validations/*.ts` (shared Zod for RHF client + Server Action server) |
| Actions | `actions/{auth,user,admin,items}.ts` |
| Tests | `lib/**/*.test.ts` (Vitest unit), `e2e/*.spec.ts` (Playwright) |
| Infra | `Dockerfile`, `../docker-compose.yml`, `drizzle/{seed.ts,migrations/}` |
