# AI Coding Template (Next.js) — Product & Architecture Quick View

> One-page snapshot of what this repo actually is and does, for a new session (human or
> agent) that hasn't read the epic history. Not a replacement for `CLAUDE.md` (rules) or
> `docs/epics/EPIC_INDEX.md` (history) — this is the *shape*. Current as of **v0.4.0
> (2026-08-22)**.

## What it is

A production-ready **Next.js SaaS starter template** — not a finished product for a specific
business. It ships auth, RBAC, billing, an admin console, and a modular `@saas/*` add-on
registry, so a fork can start writing domain features on day one instead of re-building
plumbing. The three domain tables that ship in the template (`items`, `products`/`orders`,
and the entitlement-derived 內容庫/library view) are reference examples the seed data
exercises — a real fork typically replaces `items` with its own domain and keeps the
plumbing around it.

| | |
|---|---|
| **Stack** | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Drizzle ORM (postgres-js) · Auth.js v5 |
| **Full dependency list** | `next-app/package.json` (`dependencies`/`devDependencies`) — don't restate versions here, they drift; read the file |
| **Version** | Read live from `next-app/package.json` `"version"` via `lib/branding.ts` `APP_VERSION`, rendered as a muted label in the dashboard sidebar footer (`components/app-sidebar.tsx`) — see the `release-versioning` skill for the bump chain |
| **Migrations** | 15 files, `0000`–`0014` (`next-app/drizzle/migrations/`) |

## Login & identity — and why it's built this way

Auth.js v5 with three providers: **Credentials** (email + password, the primary path),
plus optional **Google** and **GitHub** OAuth (`next-app/lib/auth.ts`). Email/password
signups go through an email-verification gate; either path can additionally enroll in
**TOTP 2FA** (`lib/totp-utils.ts`, `lib/pending-2fa.ts`) with backup codes.

**The one gotcha every new session re-discovers the hard way:** sessions use the **JWT**
strategy, not `DrizzleAdapter`'s default database-session strategy. This is not a style
choice — `next-app/lib/auth.ts` states it directly:

> JWT sessions are REQUIRED: the Credentials provider cannot create database sessions, so
> with the DrizzleAdapter's default "database" strategy a credentials login produces no
> usable session and `auth()` returns null.

The consequence: a role change doesn't take effect until the JWT is re-minted, so every
RBAC guard **re-reads the role from the database** on each request instead of trusting the
token's snapshot — `getLiveRole()` in `lib/permissions.ts`. Edge middleware
(`next-app/auth.config.ts`) only enforces *authentication* (logged in / not) for exactly
this reason — it deliberately skips role checks, because the Edge runtime's JWT doesn't
carry a live role. Real authorization happens server-side in Server Actions and Server
Components via `requireAdmin()` / `requireEditor()` / `getLiveRole()`. Background: the
`nextjs-saas-patterns` skill.

## Explicitly not built (don't add these back in without reading the pointer)

| Non-goal | Confirmed by | If you do want this, start here |
|---|---|---|
| **Multi-tenancy isolation** | No `organizationId`/tenant column anywhere in `lib/schema/*` — roles are global, not per-org | Add a tenant column to the core tables and thread it through every query + the RBAC guards in `lib/permissions.ts` |
| **Extracted i18n string catalogue** | UI copy is hardcoded 繁體中文 throughout components; no `next-intl`/`i18next`/`react-intl` in `package.json` | Introduce a message-catalog library and move strings out of `.tsx` files incrementally, page by page |
| **Server-side pagination** | `components/data-table-generic.tsx` uses TanStack Table's `getPaginationRowModel()` — the full result set is fetched once and paged client-side | Swap the `<DataTable>` data source for a paginated Server Action (`limit`/`offset` or cursor) and drop the client-side full fetch |
| **Realtime push** | No WebSocket/SSE/Pusher/Ably import anywhere in `next-app/lib` or `next-app/app` | Add a Route Handler with Server-Sent Events, or wire a provider (Pusher/Ably); nothing here to compose into yet |
| **Production-grade rate limiting** | `lib/rate-limit.ts`'s own header: "Lightweight in-memory rate limiter... state is lost on restart and is NOT shared across serverless instances or horizontally-scaled replicas" | Read that header, then follow `docs/deployment/rate-limiting.md`'s migration path to Redis/Upstash |

## Roles & permissions

Three-tier RBAC — **admin / editor / viewer**. The capability matrix (which role can do
what) and its 6 gated capabilities are pinned by a doc↔code contract test (E341,
`next-app/lib/doc-contract.test.ts`) against `lib/team-utils.ts`'s `CAPABILITIES` and
`PERMISSION_MATRIX` — **that file is the single source of truth for the values**; this
page intentionally does not restate them (two copies of the same table is the exact drift
this template is trying to eliminate). Live at runtime: Dashboard → Admin → Permission
Matrix. Enforcement pattern: `requireAuth()` / `requireEditor()` / `requireAdmin()` in
`lib/permissions.ts`, plus the `defineAction()` factory (E323,
`next-app/lib/define-action.ts`) for guard → validate → authorize → handler → audit →
revalidate in one composed pipeline.

## Main screens

The dashboard nav is the live inventory of top-level screens — as of this writing it's
hardcoded in `components/app-sidebar.tsx`'s `navMain` array (dashboard · items · 內容庫
library · settings · system · admin + sales pages for admins); Epic E336 introduces a
`lib/nav.ts` single source of truth that the sidebar, tab bar, breadcrumb, and command
palette will all consume instead of four separate hardcoded lists — once that lands, point
here instead. Deeper surfaces worth knowing about up front:

- **Settings** (`app/(dashboard)/dashboard/settings/`) — profile, password, 2FA/security.
- **System** (`app/(dashboard)/dashboard/system/`) — API keys, outbound webhooks + delivery
  log, billing/subscription panel, audit log viewer.
- **Admin** (`app/(dashboard)/dashboard/admin/`) — members + role assignment, permission
  matrix, orders, subscriptions, conversion funnel, sales-page management.
- **`/p/[slug]`** — standalone one-time-purchase sales pages (structured or fully-custom
  render mode), independent of the dashboard shell.

## Billing

Two payment providers are wired behind a single resolver (`lib/billing/resolver.ts`,
`BILLING_PROVIDER` env var): **Stripe** (subscriptions) and **ECPay 綠界** (recurring
定期定額). Plan slugs/prices live in `config/pricing.json` and are pinned by the same
E341 contract test — this page points at the file, not the numbers. One-time digital
products use a separate `products`/`orders` pair (see `docs/reference/guide-domain-digest.md`
§ orders for the state machine) whose PAID rows double as the entitlement record for the
內容庫 library view — there is no separate entitlements table (`lib/entitlements.ts`).

## Go deeper

| Need | Go to |
|---|---|
| Domain rules with sourced values (fork this for your own domain) | `docs/reference/guide-domain-digest.md` |
| Design-handoff bundle convention | `docs/_handoff/README.md` |
| Epic-by-epic dev history | `docs/epics/EPIC_INDEX.md` |
| Hard-won stack gotchas (auth, RBAC, seed, Docker, i18n) | `.claude/skills/nextjs-saas-patterns/SKILL.md` |
| Deploy mechanics (Zeabur / GCP) | `.claude/skills/deploy-config/SKILL.md` |
| Full doc navigation index | `docs/README.md` |
