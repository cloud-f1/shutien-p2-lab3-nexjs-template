# Product Requirements Document — 產品需求文件

> **AI App Template** — 通用全端 SaaS 起手式模板
> A production-ready full-stack SaaS starter (Next.js) with optional AI-powered development.
> 最後更新 / Last updated: 2026-06-16 (E277 — Next.js migration reconciliation)

---

## 1. Product Overview / 產品概述

**AI App Template** 是一套即開即用的全端 SaaS 起手式，讓開發者在 5 分鐘內從 clone 到上線開發。

- **核心價值**：省去 2–4 週的 SaaS 基礎建設，直接從業務邏輯開始
- **雙模式**：搭配 Claude Code 可解鎖 12 個 AI Agent 自動開發；不用也能當獨立 SaaS 模板
- **模組化架構**：`@saas/*` 模組註冊表讓你新增 / 移除業務模組，刪目錄即移除功能

**AI App Template** is a production-ready full-stack SaaS starter (a single Next.js app) that gets developers from clone to running in 5 minutes.

- **Core value**: Skip 2–4 weeks of SaaS boilerplate — start from business logic
- **Dual mode**: Pair with Claude Code to unlock 12 AI agents for automated development; works standalone too
- **Modular architecture**: The `@saas/*` module registry lets you add/remove business modules — delete a directory to remove a feature

---

## 2. Tech Stack / 技術棧

A **single Next.js 16 application** under `next-app/` — no separate backend service.

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) + React 19 + TypeScript |
| **Styling / UI** | Tailwind CSS v4 + shadcn/ui (`components/ui/`) + dark-mode theming (`next-themes`) |
| **Backend logic** | Server Components + Server Actions (`actions/*.ts` `"use server"`) + Route Handlers (`app/api/**/route.ts`) |
| **Auth** | Auth.js v5 (Credentials) with **JWT sessions** + bcrypt (`lib/auth.ts`, `proxy.ts`) |
| **RBAC** | 3-tier roles (admin / editor / viewer); guards re-read role from DB (`lib/permissions.ts`, `lib/is-admin.ts`) |
| **Database** | PostgreSQL 15 + Drizzle ORM (postgres-js) + drizzle-kit migrations |
| **Validation** | Shared Zod schemas (`lib/validations/*`) |
| **Testing** | Vitest (unit) + Playwright (e2e) — `pnpm test` / `pnpm test:e2e` from `next-app/` |
| **Deploy** | Zeabur (primary, single service) · GCP Cloud Run + Cloud SQL (secondary) |
| **CI/CD** | GitHub Actions (manual-trigger only since 2026-05-20; see §3.9) |

> 詳細技術架構請參閱 [TECHSTACK.md](../TECHSTACK.md)
> For detailed architecture, see [TECHSTACK.md](../TECHSTACK.md)

---

## 3. Core Features / 核心功能

### 3.1 Authentication / 認證系統

| Feature | Detail |
|---------|--------|
| Sessions | Auth.js v5 (NextAuth) with **JWT session strategy** — required for Credentials login (not DrizzleAdapter DB sessions) |
| Credentials | Email + password via bcrypt (`lib/auth.ts`, `lib/password.ts`); session token in an httpOnly cookie |
| Edge guard | `proxy.ts` runs the lightweight `auth.config.ts` to gate routes before they render |
| Auth Pages | Login + Register (shadcn `login-01` / `signup-01` blocks) under `app/(auth)/` — fully responsive |
| Account Settings | Update profile / change password via Server Actions (`actions/user.ts`) |

### 3.2 Dashboard / 控制台

- shadcn `sidebar-01` + `dashboard-01` shell under `app/(dashboard)/`
- Fully responsive design with dark-mode theming
- Ready to extend with your own pages and Server Actions

### 3.3 Module System / 模組系統

| Feature | Detail |
|---------|--------|
| Module Registry | `@saas/*` registry — each module ships code + `module.manifest.json` + a paired `install-<module>` skill |
| Reference example | The `items` feature: Drizzle table (`lib/schema/items.ts`) + Zod (`lib/validations/items.ts`) + Server Action (`actions/items.ts`) + dashboard page (`app/(dashboard)/dashboard/items/`) |
| CRUD convention | Create/edit via shadcn `Dialog` modals + `<DataTable>` for lists; Server Actions return success (no redirect) — see CLAUDE.md (E273) |
| Install | `npx shadcn@latest add @saas/<module>` then run the matching `install-<module>` skill |

> **Note:** No live business modules ship enabled by default — `items` is the canonical CRUD reference; `@saas/*` modules (landing, billing-stripe, billing-ecpay, etc.) are opt-in. Add what you need.

### 3.4 Email Provider / 郵件系統

- Pluggable email sender (`lib/email.ts`) — console/dev provider out of the box
- **mailpit** runs in `docker-compose` for local SMTP capture (UI on `:8025`)
- Swap in a transactional provider (Resend / Mailgun / SES) by editing `lib/email.ts`

### 3.5 Theme System / 主題系統

- shadcn **blue preset** + Tailwind CSS v4 `dark:` variants via `next-themes` (class strategy)
- Toggle in `components/theme-provider.tsx` (keyboard shortcut `d`)
- Design tokens in `app/globals.css`; WCAG 2.1 AA accessibility target — no inline `style=` color overrides

### 3.6 Security / 安全機制

| Threat | Defense |
|--------|---------|
| Session theft | JWT session token in httpOnly cookie; `AUTH_SECRET` signs it |
| Password storage | bcrypt hashing (`lib/password.ts`) |
| Brute force | Rate limiting on auth/sensitive routes (`lib/rate-limit.ts`) |
| Sequential ID guessing | UUID primary keys (`uuid().defaultRandom()`) |
| RBAC | 3-tier roles (admin / editor / viewer); guards **re-read the role from the DB** (`lib/permissions.ts`, `lib/is-admin.ts`) — never trust the JWT role blindly |
| Input validation | Shared Zod schemas (`lib/validations/*`) on every mutation |
| Audit | Audit logging for sensitive operations (`lib/audit.ts`) |

### 3.7 Internationalization / 國際化

- Full **繁體中文** UI strings (Phase 56 i18n)
- Bilingual documentation (EN + 繁體中文)

### 3.8 Testing / 測試

| Suite | Tool | Notes |
|-------|------|-------|
| Unit | Vitest | `lib/validations`, `lib/is-admin`, `lib/*-utils`, actions — `pnpm test` from `next-app/` |
| E2E | Playwright | needs a seeded DB (`pnpm db:seed`); `pnpm test:e2e` |
| Coverage | `pnpm test:coverage` (v8) | meaningful coverage on `lib/` + actions |
| Gate | Stop-verifier + `scripts/pre-merge-check.sh` (typecheck + lint + unit + e2e) | Enforced locally (CI is manual-trigger-only — see §3.9) |

### 3.9 CI/CD & Deployment / 持續整合與部署

- **CI**: GitHub Actions workflows exist but are **manual-trigger-only** (`workflow_dispatch`) since 2026-05-20 (commit `c7015b6`). Re-enabling is the owner's deliberate call — do NOT auto-arm them.
- **Deploy**: Zeabur (primary, `next-app/` as a single service with `zbpack.json`); GCP Cloud Run + Cloud SQL (secondary). See the `deploy-config` skill.
- **Migrations**: `pnpm db:migrate` (drizzle-kit) on startup / pre-deploy.
- **Docker**: `docker compose up --build -d` runs Postgres + migrate/seed + web (+ mailpit).

### 3.10 Developer Experience / 開發者體驗

| Command | What It Does |
|---------|-------------|
| `make local` | Local dev — Docker infra (Postgres) + Next.js on http://localhost:3000 |
| `docker compose up --build -d` | Full stack in Docker: Postgres + migrate/seed + web + mailpit |
| `pnpm dev` (from `next-app/`) | Start the dev server directly |
| `pnpm db:generate` / `db:migrate` / `db:seed` | Drizzle: generate migration · apply · seed demo users |
| `pnpm test` / `test:e2e` | Vitest unit · Playwright e2e |
| `pnpm typecheck` / `lint` / `format` | tsc · ESLint · Prettier |
| `scripts/pre-merge-check.sh [--e2e]` | Quality gate: repo hygiene + typecheck + lint + unit (+ e2e) |
| `pnpm registry:build` / `module:validate` | Build the `@saas/*` module registry / validate a module |

---

## 4. AI Development Pipeline / AI 開發管線

> 以下功能需要搭配 [Claude Code](https://claude.ai/code) 使用。不使用 Claude Code 的話，模板依然是完整的 SaaS 起手式。
>
> The following features require [Claude Code](https://claude.ai/code). Without it, the template still works as a standalone SaaS starter.

### 4.1 Agent Team / AI 代理團隊 (12 Agents)

| Agent | Role | Trigger |
|-------|------|---------|
| @spec-writer | Design a feature spec (Drizzle schema + Zod + Server Action / Route Handler signatures + RBAC) → `docs/epics/` | `/athena:spec` |
| @reviewer | Read-only code review + security audit | `/athena:qa --review-only` |
| @qa | Test execution (`next-app/` pnpm gates) + coverage | `/athena:qa --test-only` |
| @evaluator | Independent acceptance evaluation | `/athena:qa --eval-only` |
| @best-practice | Architecture decisions, trade-off analysis | Auto |
| @debugger | Error diagnosis, failing test resolution | Auto |
| @deployer | 7-gate deployment protocol (Zeabur) | `/athena:deploy` |
| @memory-curator | Extract generalizable wisdom to Tier 0 | `/athena:promote` |
| @strategist | Strategic planning, epic proposals | `/athena:plan` |
| @orchestrator | Parallel epic coordination, dependency waves | `/athena:batch` |
| @designer | Design tokens → React page (TSX + CSS) | `/athena:design` |
| @dba | drizzle-kit migration review, schema design, DB forensics | `/athena:dba` |

### 4.2 Slash Commands / 指令系統 (23 Commands)

| Command | Purpose |
|---------|---------|
| `/athena:spec <feature>` | Design a feature spec (Drizzle + Zod + Server Action / Route Handler + RBAC) → `docs/epics/` |
| `/athena:implement` | TDD cycle: spec → code → qa |
| `/athena:qa` | Code review + test suite (`next-app/` pnpm gates) |
| `/athena:loop` | Epic loop — advance one step |
| `/athena:ship` | Quick publish: review → fix → commit → PR |
| `/athena:pr` | Full pipeline: merge main → build → test → lint → PR |
| `/athena:deploy` | 7-gate deploy to Zeabur |
| `/athena:load` | Read all context docs, summarize state |
| `/athena:save` | Checkpoint all agents + session summary |
| `/athena:plan` | Strategic planning → epic proposals |
| `/athena:cycle` | Full DevOps cycle |
| `/athena:learn` | Refresh memory accuracy |
| `/athena:promote` | Extract lessons to cross-project memory |
| `/athena:audit` | Drift check: Drizzle schema ↔ Zod ↔ Server Action / Route Handler / UI |
| `/athena:dba` | drizzle-kit migration tools (inspect / lint / diagnose / fix) |

### 4.3 Skills / 技能模組

Auto-loaded context injectors that provide domain-specific knowledge:
- `nextjs-saas-patterns` (Auth.js v5 / Drizzle / shadcn gotchas), `next-best-practices`
- `athena-loop-speedups` (orchestration practices), `deploy-config`
- `module-author` + the `install-*` module skills (landing, stripe-billing, ecpay-billing)
- vendor `vercel-*` React/Next.js best-practice packs
- Count via: `ls -1d .claude/skills/*/ | wc -l`

### 4.4 Memory System / 記憶系統

```
Tier 0 (Global):  ~/.claude/template-memory/   Cross-project wisdom (15 files)
Tier 1 (Project): docs/context/                 This project's state (16 files)
```

- Append-only logs, each agent owns exactly one file
- `/athena:save` → all agents checkpoint simultaneously
- `/athena:promote` → extract generalizable lessons to Tier 0

### 4.5 Lifecycle Hooks / 生命週期鉤子

- **SessionStart**: Injects branch, session-summary, epic-progress, recent git activity
- **PreToolUse**: Guards against destructive commands and dirty deploys
- **PostToolUse**: Auto-formats edits, logs bash commands
- **SubagentStop**: Timestamps write-backs

---

## 5. Architecture / 架構原則

### Non-Negotiable Rules / 不可違反的規則

1. **Default to Server Components** — add `"use client"` only for browser APIs / events / state
2. Path alias `@/*` resolves to `next-app/` root — no relative `../../` imports
3. Auth.js v5 Credentials needs **JWT sessions** (not DrizzleAdapter DB sessions); RBAC guards re-read the role from the DB
4. shadcn/ui lives in `components/ui/` — add via `npx shadcn@latest add`, never hand-author
5. Drizzle for all DB access (no raw SQL, no Prisma); mutations via Server Actions (`"use server"`)
6. `cn()` for conditional Tailwind; theme via `dark:` variants — no inline `style=` color overrides
7. CRUD uses modals, never page redirects (E273); lists use the reusable `<DataTable>`

### Spec-Driven Development (SDD)

```
Feature spec → Drizzle migration → Server Action / Route Handler → UI + Tests → Deploy
```

- A **feature spec** (Drizzle table + shared Zod schema + Server Action / Route Handler
  signatures + RBAC) is written to `docs/epics/` by `@spec-writer` — there is no OpenAPI contract.
- Shared Zod schemas (`lib/validations/*`) are the single source of truth for input shape.
- `/athena:audit` checks drift between the Drizzle schema, the Zod schemas, and the
  Server Actions / Route Handlers / UI that consume them.

### Feature Architecture

A feature is a few co-located files in the single Next.js app (the `items` reference):

```
next-app/
  lib/schema/{name}.ts        Drizzle table (pgTable) + inferred type
  lib/validations/{name}.ts   Shared Zod schema(s)
  actions/{name}.ts           Server Actions ("use server") — mutations + RBAC guard
  app/api/**/route.ts         Route Handlers (when an HTTP endpoint is needed)
  app/(dashboard)/dashboard/{name}/
    page.tsx                  Server Component page (direct DB fetch)
    _*.tsx                    Dialog form + DataTable client components
  drizzle/migrations/*.sql    drizzle-kit migration (pnpm db:generate → db:migrate)
```

- Mutations run as Server Actions guarded by `requireEditor()` / `requireAdmin()`
  (`lib/permissions.ts`) and validated by the shared Zod schema.
- Lists render with `<DataTable>`; create/edit use shadcn `Dialog` modals (E273).
- **Note:** `items` is the canonical reference, not a shipped business feature. Copy its
  shape (schema + zod + action + page) to build your own, or pull a `@saas/*` module.

---

## 6. What You Get / 你會得到什麼

| Category | Count |
|----------|-------|
| Unit tests | Vitest — `lib/` + validations + actions (`pnpm test`) |
| E2E tests | Playwright — seeded-DB flows (`pnpm test:e2e`) |
| AI Agents | 12 |
| Slash Commands | 23 |
| Skills | `nextjs-saas-patterns`, `next-best-practices`, `athena-loop-speedups`, `deploy-config`, `module-author` + `install-*` + vendor `vercel-*` |
| Theme | shadcn blue preset + light/dark (`next-themes`) |
| Auth | Auth.js v5 Credentials + JWT sessions |
| RBAC | 3 tiers (admin / editor / viewer) |
| Deployment | Zeabur (primary) · GCP Cloud Run + Cloud SQL (secondary) |

### File Structure

```
├── next-app/                 Single Next.js 16 app (App Router)
│   ├── app/                  Pages + layouts; (auth)/ + (dashboard)/ route groups; api/**/route.ts
│   ├── actions/              Server Actions ("use server") — mutations
│   ├── components/           Shared components; components/ui/ = shadcn (generated)
│   ├── lib/
│   │   ├── schema/           Drizzle tables (pgTable)
│   │   ├── validations/      Shared Zod schemas
│   │   ├── auth.ts           Auth.js v5 (Credentials + JWT)
│   │   ├── permissions.ts    RBAC guards (re-read role from DB)
│   │   └── db.ts             Drizzle + postgres-js client
│   └── drizzle/migrations/   drizzle-kit migrations + seed
├── docs/
│   ├── PRD.md                This document
│   ├── guides/               EN + ZH-TW quickstart & tutorials
│   └── epics/                Epic-driven development tracker (feature specs live here)
├── scripts/                  Lifecycle & quality-gate scripts (pre-merge-check.sh, hooks/)
├── .claude/
│   ├── agents/               12 AI agent definitions
│   ├── commands/athena/      23 slash commands
│   └── skills/               Context injectors
├── Makefile                  Dev commands (make local / smoke / init)
└── CLAUDE.md                 Session identity (auto-loaded)
```

---

## 7. Quickstart / 快速開始

```bash
# Clone
git clone https://github.com/cloud-f1/ai-coding-nexjs-template.git
cd ai-coding-nexjs-template

# Fastest path — full stack in Docker (Postgres + migrate/seed + web + mailpit)
docker compose up --build -d
open http://localhost:3000          # mailpit on http://localhost:8025

# Demo logins (seeded):
#   admin@example.com  / Admin123!
#   editor@example.com / Editor123!
#   viewer@example.com / Viewer123!
```

> 詳細步驟請參閱 [Quickstart Guide](guides/en/quickstart.md) | [快速入門](guides/zh-TW/quickstart.md)

---

## 8. Roadmap / 路線圖

### Short-term / 短期

| Item | Priority | Description |
|------|----------|-------------|
| Template Showcase Site | Medium | Interactive demo showcasing template capabilities |
| Performance Baseline | Medium | Lighthouse CI, bundle analysis, API latency benchmarks |
| Real-time Notifications | Low | WebSocket / SSE push notifications |

### Mid-term / 中期 (Q3-Q4 2026)

| Item | Priority | Description |
|------|----------|-------------|
| Multi-tenancy | High | Tenant isolation, subdomain routing |
| Sentry Error Tracking | Medium | Client + server (RSC / Server Actions) integration |
| Report Export | Low | CSV / PDF report generation |

### Long-term / 長期 (2027+)

| Item | Type | Description |
|------|------|-------------|
| Cross-platform AI | Integration | Multi-AI agent collaboration (Gemini, Codex, Claude) |
| Mobile App | Cross-platform | React Native or PWA |
| Plugin System | Platform | Third-party module marketplace |
| AI Analytics | AI | Data trend analysis, smart suggestions |

---

## 9. Version History / 版本歷史

| Version | Date | Milestone |
|---------|------|-----------|
| v1.0.0 | 2026-03-15 | Production-ready: 77 epics, 23 phases, full SaaS template |
| v0.12.0 | 2026-03-14 | Universal template transformation |
| v0.11.0 | 2026-03-13 | Interactive Site Builder CLI |
| v0.10.0 | 2026-03-13 | Security, accessibility, theme system |
| v0.9.0 | 2026-03-12 | Domain CRUD, deploy, CI/CD |

---

*AI App Template — PRD v2.0 — 2026-06-16 (E277: Next.js migration — stack, architecture, agent-brain reconciliation)*
