# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Planned: Account & Admin modules packaged as `@saas` registry modules; TapPay / NewebPay (藍新) providers; usage-based billing; teams._

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

[Unreleased]: https://github.com/cloud-f1/ai-coding-nexjs-template/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/cloud-f1/ai-coding-nexjs-template/releases/tag/v0.1.0
