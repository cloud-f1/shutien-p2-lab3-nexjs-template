# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Planned: TapPay / NewebPay (藍新) providers; usage-based billing; teams._

## [0.4.0] - 2026-07-08

The **Backport Wave 2 program** (Phases 75–76, E319–E325) pulled the *executable* tooling and
reusable patterns that the downstream product `ai-rc-engineer-pm` (瑞成 PMS) hardened after the
earlier skill/docs-level backport (Phase 73). This wave ships runnable guards, a real test
middle layer, CI/deploy hardening, a Server-Action factory + UI primitives, and five opt-in
`@saas` modules — all generalized (no product/domain literals). All merged to `main`.

### Added

- **Executable dead-code & architecture guards** (E320) — `scripts/service-map.cjs` (import-graph → Mermaid + orphan detection) and `scripts/check-orphan-exports.mjs` / `pnpm check:orphans` (flags `lib/` exports tested but never called). Upgrades Phase 73's docs-only map to runnable tools.
- **Test pyramid middle layer** (E321) — throwaway-DB integration harness + `pnpm test:int`, a jsdom/RTL component-test layer, and a `docs/qa/` process (pyramid audit + manual-test-plan scaffold).
- **`defineAction` Server-Action factory** (E323) — guard → Zod → authorize → handler → audit → revalidate; `deleteItem` migrated as a reference; recognized by the stop-verifier.
- **Reusable UI primitives** (E323) — `responsive-modal` (Dialog↔Sheet), `calendar`/`date-picker`/`textarea`, `mobile-tab-bar`, and a `ui-spec-epic` surface-contract epic template.
- **Five opt-in `@saas` registry modules** — `scheduler` (in-process node-cron), `audit-log` (immutable before/after trail) (E323); `rbac-scoped-visibility` (assignment-scoped row visibility), `sentry-pii` (PII scrubber composing with the existing Sentry), `csv-io` (export helpers + generic keyed import) (E325). Each with a paired `install-*` skill.
- **Second deploy road + release hardening** (E322) — `make deploy-gcp` (Cloud Run + Cloud SQL), `make verify` umbrella gate, `make db-migrate-prod` (CONFIRM-guarded), `deploy/.env.deploy.example`, and a `user-docs/` VitePress end-user-manual scaffold.
- **Version in the sidebar** (E322) — `APP_VERSION` in `lib/branding.ts` reads `package.json` directly (no git-tag↔UI drift).

### Changed

- **CI re-enabled + hardened** (E322) — push/PR triggers restored; all actions SHA-pinned; `permissions: contents: read`; `package_json_file` pointer; a docs-build job; and the docs-deploy workflow split into path-scoped dev-docs / user-docs pipelines.
- **Orchestration & guardrails** (E319) — `/athena:flow` gains a **Sequential In-Repo Chain Mode** for coupled/migration-heavy waves; `/athena:audit` gains **knowledge-drift** checks (doc↔code constants + post-rebrand brand/identity staleness); the stop-verifier gains a `// stop-verifier:public-action` exemption marker + guard-family recognition.
- **Doctrine** (E322) — `CLAUDE.md` documents runtime-vs-build-time env, per-env seeding, and a multi-env deploy table; `CONTRIBUTING.md` adds a "Ship discipline" section.

### Fixed

- **Orphan remediation** (E324) — resolved all 8 tested-but-unwired `lib/` guards `check:orphans` found (`check:orphans` now reports 0): 2 wired, 6 removed as dead duplicates.
  - **Password no-op change now rejected** — `assertPasswordChanged` is wired into `changePassword`; a same-as-current password change is blocked (was silently succeeding) with no DB write. Covered by a new integration test.

## [0.3.0] - 2026-06-16

The **E274–E293 program** (Phases 63–68) hardened the data/billing money-path, finished the
FastAPI→Next.js cleanup of the Athena tooling, made the template fork-able and production-ready,
and added a generated OpenAPI contract, a public REST API, security headers, password-reset/invite
emails, a Stripe billing portal, CI, and baseline observability. All merged to `main`.
Unit tests now ~327 green; migrations through 0007.

### Added

- **Generated OpenAPI contract** (E281) — `@asteasolutions/zod-to-openapi` derives the contract from the Zod validation layer, served at `/api/openapi`, with a coverage guard and a smoke drift-gate so the spec can't silently diverge from the schemas.
- **Public REST API** (E291) — `app/api/v1/items` authenticated by `api_keys` (`verifyApiKey` + scopes), registered in the E281 OpenAPI contract.
- **Stripe Customer Portal** (E292) — `createPortalSession` + a Manage-billing button, plus billing e2e coverage.
- **Password-reset flow + invite emails** (E290) — migration 0007 adds `password_reset_tokens`.
- **HTTP security headers + CSP** (E289) — `lib/security-headers.ts` applied to all routes via `next.config.ts`.
- **GitHub Actions CI** (E288) — `.github/workflows/ci.yml` (a follow-up, PR #43, switches its auto-trigger to manual-only).
- **Baseline observability** (E293) — `instrumentation.ts` + env-gated Sentry + `lib/logger.ts`; `lib/audit.ts` now logs failures.
- **`/athena:domain` scaffold restored** (E283) — a copy-from-items domain generator (`scripts/new-domain.sh` + `make new-domain`).
- **One-knob rebrand** (E285) — `NEXT_PUBLIC_APP_NAME` / `lib/branding.ts` wired through root metadata; demo-login hardened; `engines` pinned.
- **Env-driven `@saas` registry install** (E284) — `SAAS_REGISTRY_URL` + guarded install-landing + drift warnings; homepage repointed to cloud-f1.

### Changed

- **Athena tooling made Next.js-native** (E277) — `/athena:dba` → drizzle-kit, `/athena:audit` → Drizzle/Zod/UI drift; 9 agents + 9 commands de-staled of FastAPI/Vite assumptions.
- **Stop-verifier rewritten for `next-app/`** (E282) — 8 Next.js rules replace the 23 dead FastAPI/Vite rules; `scripts/hooks/CLAUDE.md` refreshed; `dba-migrations.md` added.
- **Schema split** (E275) — `lib/schema.ts` → `lib/schema/{auth,items,billing,system}` + a barrel; migration 0006 adds composite PKs / UNIQUEs / indexes.
- **API consistency/correctness** (E276) — `deleteUser` writes an audit log, billing actions `requireAuth` + 繁中, webhooks are https-only, `acceptInvitation` is transactional, and the billing enum has a single shared source.
- **Onboarding + dev docs rewritten to Next.js** (E278, E286) — removed-subsystem docs deleted; the fork guide is Next.js-native; README moved to `docs/guides/`.
- **Single-service deploy** (E287) — `deploy-zeabur.sh` consolidated; Dockerfile takes a `NEXT_PUBLIC_APP_URL` ARG; GCP migrate/seed runs via the builder image with the correct seed path.

### Removed

- **Dead FastAPI + Vite stack** (E279, E280) — deleted the FastAPI/Vite worked examples + templates and 33 dead-stack scripts/config files; the Makefile is now Next.js-only; `.pre-commit` / `.dockerignore` / pre-deploy-guard fixed.

### Fixed

- **Billing money-path** (E274) — corrected the plan-id → UUID FK, persist `currentPeriodEnd`, added a cancel-subscription UI and a real `reconcile()`, an ECPay renewal cron, and a SQLSTATE-23505 idempotent upsert. (E274a JSON-configurable pricing + checkout shipped earlier, PR #19.)

## [0.2.0] - 2026-06-15

Builds on the v0.1.0 foundation with a full design-system pass, real backend-backed
SaaS surfaces (API keys, webhooks, audit, team invites, billing UI, notifications),
and deployment enablement.

### Added

- **Deployment enablement** (Phase 59) — Zeabur (`zbpack.json` + runbook) and **GCP Cloud Run + Cloud SQL** (`gcloud` runbook) deploy paths, `.env.example`, a `deploy-config` skill, and a one-shot tool installer.
- **Cobalt design system** (Phases 60–61) — oklch design tokens + a premium FX layer (aurora / shimmer / glow / reveal, `prefers-reduced-motion` safe); landing-page redesign; dashboard polish (KPI cards, semantic badges/dots); **⌘K command palette**; notifications dropdown; breadcrumbs; expanded tabbed **settings** (profile / account / appearance / notifications / connected); auth split-screen; and a `/dashboard/components` reference page.
- **Backend SaaS surfaces** (Phase 62, migration 0005) — **API keys** (sha256-hashed, shown once, bearer-auth verify), outbound **webhooks** (HMAC-SHA256 signed dispatch + retry/backoff + delivery log), **audit log** (admin viewer), **team invitations** + permission matrix (`/invite/[token]`), in-app **billing UI** (plan summary / usage / invoices), and real-data **notifications**. Owner/admin RBAC throughout; pure logic in db-free `*-utils` modules with unit tests.
- **Fresh-DB migration gate** — `pnpm db:test-migrate` applies every migration to a throwaway database, asserts all tables, then drops it; wired into `make smoke`.
- **Enriched demo seed** — `pnpm db:seed` now populates billing, API keys, webhooks, audit, invites, notifications, and items so the demo looks designed (idempotent).
- **Playwright visual-regression (VRT)** gate for the design-stable surfaces.

### Changed

- Unit-test coverage scope narrowed to the db-free logic layer (db-bound actions are covered by e2e) — an honest **80.7%** statements (a previous figure counted actions that cannot be unit-tested by design).
- `next-app/package.json` version → `0.2.0`.

### Fixed

- API-key parse: the prefix is now delimiter-free (hex) so a base64url secret containing `_`/`-` can no longer be mis-split — previously valid keys could be rejected intermittently.

## [0.1.0] - 2026-06-15

First tagged release. The project completed its migration from a FastAPI + Vite SPA
stack to **Next.js 16**, then hardened into an **AI-Ready, modular SaaS starter**.

### Added

- **Next.js 16 (App Router) foundation** — React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui.
- **Auth.js v5 (NextAuth)** — Credentials (bcrypt) + Google OAuth, **JWT session strategy**, email-verification tokens, password reset, login rate-limiting.
- **3-tier RBAC** — `admin` / `editor` / `viewer` (migration 0003); guards re-read the role from the DB.
- **shadcn/ui blue preset** + Tailwind `dark:` theming (next-themes) + full **繁體中文 i18n** (UI, Zod messages, Server Action errors, metadata).
- **Items CRUD** demo domain (editor-gated) with shared RHF + Zod forms.
- **AI-Ready modular `@saas` registry** — `registry.json` + `pnpm registry:build` → `public/r/*.json`, `components.json` `@saas` namespace, `module.manifest.json` spec + JSON Schema + `pnpm module:validate`, `module-author` + `install-*` skills, `hello-module` smoke item.
- **PaymentProvider abstraction** (`lib/billing/provider.ts`) — env-selected resolver (default `stripe`) + Drizzle `plans` / `subscriptions` (`provider_meta` JSONB) / `payment_events` (idempotency unique), migration 0004.
- **`@saas/billing-stripe`** (default) — Checkout + signed webhook (`constructEvent`, idempotent, out-of-order tolerant).
- **`@saas/billing-ecpay`** — 定期定額 recurring billing (CheckMacValue SHA256) + dual notify route handlers (ReturnURL + PeriodReturnURL).
- **`@saas/landing`** — marketing route group (hero / features / pricing / FAQ / CTA).
- **MCP** — `.mcp.json` (`@saas` namespace) so an AI agent can read the registry + manifests and install a module by natural language.
- **VitePress dev-docs site** → Cloudflare Pages (live: <https://ai-coding-nexjs-template-docs.pages.dev/>) — module catalog, API reference, bilingual whitepaper, demo gallery.
- **Dockerized local stack** — `docker compose up --build` (postgres + migrate/seed + web + mailpit); demo seed (`admin@` / `editor@` / `viewer@example.com`).
- **Athena AI agent team** (12 agents) + Athena command namespace — worktree-parallel `/athena:batch`, native-Workflow `/athena:flow`, task-tiered model dispatch (sonnet baseline, opus for complex/ultra).
- **Quality harness** — Vitest unit + Playwright e2e, `make smoke`, `scripts/pre-merge-check.sh`, stop-verifier hooks.

### Changed

- Migrated the entire stack: FastAPI + SQLAlchemy + Alembic + React 18/Vite → **Next.js 16 + Drizzle ORM + Auth.js v5**.
- Deployment: dual client/API Zeabur services + GCR → single `next-app/` Zeabur service (`zbpack.json`); docs deploy to Cloudflare Pages.

### Notes

- Account & Admin settings ship in-app today but are **not yet packaged** as `@saas` registry modules (deferred to a later release).

[Unreleased]: https://github.com/cloud-f1/ai-coding-nexjs-template/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/cloud-f1/ai-coding-nexjs-template/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/cloud-f1/ai-coding-nexjs-template/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/cloud-f1/ai-coding-nexjs-template/releases/tag/v0.1.0
