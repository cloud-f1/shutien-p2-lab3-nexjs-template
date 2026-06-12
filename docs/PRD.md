# Product Requirements Document — 產品需求文件

> **AI-Coding-Template** — 通用全端 SaaS 起手式模板
> A production-ready full-stack SaaS starter with optional AI-powered development.
> 最後更新 / Last updated: 2026-06-01 (E205 — doc-truth reconciliation)

---

## 1. Product Overview / 產品概述

**AI-Coding-Template** 是一套即開即用的全端 SaaS 起手式，讓開發者在 5 分鐘內從 clone 到上線開發。

- **核心價值**：省去 2–4 週的 SaaS 基礎建設，直接從業務邏輯開始
- **雙模式**：搭配 Claude Code 可解鎖 9 個 AI Agent 自動開發；不用也能當獨立 SaaS 模板
- **模組化架構**：Domain Registry 讓你新增 / 移除業務模組，刪目錄即移除功能

**AI-Coding-Template** is a production-ready full-stack SaaS starter that gets developers from clone to running in 5 minutes.

- **Core value**: Skip 2–4 weeks of SaaS boilerplate — start from business logic
- **Dual mode**: Pair with Claude Code to unlock 12 AI agents for automated development; works standalone too
- **Modular architecture**: Domain Registry lets you add/remove business modules — delete a directory to remove a feature

---

## 2. Tech Stack / 技術棧

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite + Zustand + React Query |
| **Backend** | FastAPI 0.115 + Python 3.12 + Pydantic v2 |
| **Auth** | PyJWT 2.9 + bcrypt 4.x (via fastapi-users) |
| **Database** | PostgreSQL 15 + SQLAlchemy 2.x async + Alembic |
| **Testing** | pytest (server, 90%+ coverage) + Vitest (client, 80%+ gate) + MSW |
| **Deploy** | Zeabur (server + client as separate services) |
| **CI/CD** | GitHub Actions (manual-trigger only since 2026-05-20; see §3.9) |

> 詳細技術架構請參閱 [TECHSTACK.md](../TECHSTACK.md)
> For detailed architecture, see [TECHSTACK.md](../TECHSTACK.md)

---

## 3. Core Features / 核心功能

### 3.1 Authentication / 認證系統

| Feature | Detail |
|---------|--------|
| JWT Access Token | 15 min TTL, stored in-memory (`tokenCache.ts`) — never localStorage |
| Refresh Token | 30 days TTL, httpOnly cookie (prod), automatic rotation |
| OAuth | Google + GitHub, server-side callback, provider-agnostic |
| Email Verification | Token-based verify-email flow |
| Password Reset | forgot-password with anti-enumeration (fixed 202 response) |
| Auth Pages | SignIn, SignUp, ForgotPassword, ResetPassword — fully responsive |

### 3.2 Dashboard / 控制台

- 7-view sidebar layout (Overview, Projects, Memory Hub, etc.)
- Fully responsive design
- Ready to extend with your own domain views

### 3.3 Domain System / 領域模組系統

| Feature | Detail |
|---------|--------|
| Domain Registry | Auto-discovery from `server/app/domains/` — modular business logic |
| Domain Generator | `make new-domain NAME=<name>` or `/athena:domain <name>` — generates server + client + test scaffolding |
| CRUD Factory | `createService()` + `useServiceQuery()` generic CRUD with Zod validation |
| Example Domains | Blog, CRM, Todo reference implementations in `docs/examples/` |

> **Note (E205):** `server/app/domains/` currently contains only `__init__.py` — no live domain modules ship with the template. `billing`, `teams`, `places`, and `portfolios` are **empty example scaffolds, not live code**. The Domain Registry auto-discovers whatever you add; nothing ships by default.

### 3.4 Email Provider / 郵件系統

- Abstract HTTP API provider pattern (no SMTP dependency)
- Built-in providers: Console (dev), Mailgun, Zeabur Email API
- Jinja2 email templates, factory singleton

### 3.5 Theme System / 主題系統

- 6 themes: dark / indigo / navy / sage / rose / forest
- WCAG 2.1 AA accessibility compliance
- CSS architecture with design tokens

### 3.6 Security / 安全機制

| Threat | Defense |
|--------|---------|
| XSS token theft | Access token in-memory only |
| Refresh replay | Token rotation on every refresh |
| Email enumeration | forgot-password always returns 200 |
| Brute force | slowapi 5 req/min on auth routes |
| Sequential ID guessing | UUID v4 primary keys |
| RBAC | Superuser-vs-user roles via `admin.py` (is_superuser flag). Full RBAC + team scoping are **roadmap items**, not yet implemented. |
| Headers | Security headers (HSTS, X-Frame-Options, etc.) |
| Audit | Audit logging for sensitive operations |

### 3.7 Internationalization / 國際化

- react-i18next frontend framework
- Server-side message keys
- Bilingual documentation (EN + 繁體中文)

### 3.8 Testing / 測試

| Suite | Tool | Coverage |
|-------|------|----------|
| Server | pytest (asyncio_mode=auto) | ≥90% (398 passed / 4 skipped / 20 xfailed as of 2026-05-03) |
| Client | Vitest + MSW + userEvent | ≥80% (515 tests / 89.31% stmts as of 2026-05-30, 86 files) |
| Gate | Stop-verifier + coverage gate ≥80% (CI is manual-trigger-only — see §3.9) | Enforced locally |

### 3.9 CI/CD & Deployment / 持續整合與部署

- **CI**: GitHub Actions workflows exist but are **manual-trigger-only** (`workflow_dispatch`) since 2026-05-20 (commit `c7015b6`). Re-enabling is the owner's deliberate call — do NOT auto-arm them.
- **Deploy**: Zeabur one-click (`make deploy`)
- **Startup**: `alembic upgrade head && uvicorn ...` (auto-migration)
- **Docker**: Full Docker Compose dev profile available

### 3.10 Developer Experience / 開發者體驗

| Command | What It Does |
|---------|-------------|
| `make init` | One-time post-clone setup: reset template → customize → install deps → start DB → migrate |
| `make go` | Zero-config startup: prereqs → setup → DB → migrate → dev servers |
| `make tutorial` | Interactive 5-minute endpoint-building exercise |
| `make new-domain NAME=x` | Scaffold a new domain module (server + client + tests) |
| `make doctor` | Diagnose environment (tools, DB, secrets, ports) |
| `make test` | Run all test suites |
| `make deploy` | One-click Zeabur deploy with 6-gate protocol |
| `make reset` | Reset template to clean state (for re-distribution) |
| `make strip` | Remove optional files (legal, landing, guides, examples) |

---

## 4. AI Development Pipeline / AI 開發管線

> 以下功能需要搭配 [Claude Code](https://claude.ai/code) 使用。不使用 Claude Code 的話，模板依然是完整的 SaaS 起手式。
>
> The following features require [Claude Code](https://claude.ai/code). Without it, the template still works as a standalone SaaS starter.

### 4.1 Agent Team / AI 代理團隊 (12 Agents)

| Agent | Role | Trigger |
|-------|------|---------|
| @spec-writer | Design OpenAPI specs for new features | `/athena:spec` |
| @reviewer | Read-only code review + security audit | `/athena:qa --review-only` |
| @qa | Test execution + coverage gate | `/athena:qa --test-only` |
| @evaluator | Independent acceptance evaluation | `/athena:qa --eval-only` |
| @best-practice | Architecture decisions, trade-off analysis | Auto |
| @debugger | Error diagnosis, failing test resolution | Auto |
| @deployer | 7-gate deployment protocol (Zeabur) | `/athena:deploy` |
| @memory-curator | Extract generalizable wisdom to Tier 0 | `/athena:promote` |
| @strategist | Strategic planning, epic proposals | `/athena:plan` |
| @orchestrator | Parallel epic coordination, dependency waves | `/athena:batch` |
| @designer | Design tokens → React page (TSX + CSS) | `/athena:design` |
| @dba | Migration review, schema design, DB forensics | `/athena:dba` |

### 4.2 Slash Commands / 指令系統 (23 Commands)

| Command | Purpose |
|---------|---------|
| `/athena:spec <feature>` | Design a feature spec (OpenAPI-first) |
| `/athena:implement` | TDD cycle: spec → code → qa |
| `/athena:qa` | Code review + test suite |
| `/athena:loop` | Epic loop — advance one step |
| `/athena:ship` | Quick publish: review → fix → commit → PR |
| `/athena:pr` | Full pipeline: merge main → build → test → lint → PR |
| `/athena:deploy` | 6-gate deploy to Zeabur |
| `/athena:load` | Read all context docs, summarize state |
| `/athena:save` | Checkpoint all agents + session summary |
| `/athena:plan` | Strategic planning → epic proposals |
| `/athena:cycle` | Full DevOps cycle |
| `/athena:learn` | Refresh memory accuracy |
| `/athena:promote` | Extract lessons to cross-project memory |
| `/athena:domain <name>` | Scaffold a new domain module |
| `/athena:dba` | Database migration tools |

### 4.3 Skills / 技能模組 (11 Skills)

Auto-loaded context injectors that provide domain-specific knowledge:
- server-patterns, client-patterns, openapi-first
- frontend-review, tdd-workflow, debugging
- upgrade-stripe, dba-migrations, and others
- Count via: `ls -1 .claude/skills/*.md | wc -l`

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

1. `docs/openapi.yaml` edited **FIRST** — never write code before the spec
2. `import jwt` (PyJWT) — never python-jose (unmaintained, CVEs)
3. `import bcrypt` — never passlib (unmaintained)
4. Access token in `tokenCache.ts` (in-memory) — never localStorage
5. React Query tiers from `cacheConfig.ts` — never hardcode staleTime
6. Folders: `server/` and `client/` — never `backend/` or `frontend/`
7. Coverage gate: ≥80% both suites — blocks deploy

### Spec-Driven Development (SDD)

```
OpenAPI spec → Server implementation → Client implementation → Tests → Deploy
```

- `docs/openapi.yaml` is the **single source of truth** for all API types
- TypeScript types are generated from the spec (`make generate-types`)
- Server endpoints must match the spec exactly

### Domain Architecture

```
server/app/domains/
  {name}/
    models.py         SQLAlchemy models
    schemas.py        Pydantic schemas
    endpoints.py      FastAPI router
    service.py        Business logic
    __init__.py       Auto-discovery entry point

client/src/domains/
  {name}/
    page.tsx          React page component
    hooks.ts          React Query hooks
    service.ts        API client
```

- Auto-discovered: add a domain directory → it's live
- Remove the directory → feature is gone
- Templates in `docs/templates/domain/` for scaffolding
- **Note:** `server/app/domains/` ships with only `__init__.py`. No live domains (`billing`, `teams`, `places`, `portfolios`) are pre-built — they are empty example scaffolds. Use `make new-domain NAME=x` to scaffold your first domain.

---

## 6. What You Get / 你會得到什麼

| Category | Count |
|----------|-------|
| Server tests | 398 (+ 4 skipped / 20 xfailed) as of 2026-05-03 |
| Client tests | 515 as of 2026-05-30 (86 files, 89.31% stmts) |
| AI Agents | 12 |
| Slash Commands | 23 |
| Skills | 11 |
| Themes | 6 (dark, indigo, navy, sage, rose, forest) |
| Auth providers | 3 (email + Google + GitHub) |
| Email providers | 3 (console + mailgun + zeabur) |
| Make targets | 15+ |
| Deployment | One-click Zeabur |

### File Structure

```
├── server/              FastAPI + PostgreSQL backend
├── client/              React 18 + TypeScript frontend
├── docs/
│   ├── openapi.yaml     API contract (single source of truth)
│   ├── PRD.md           This document
│   ├── guides/          EN + ZH-TW quickstart & tutorials
│   ├── epics/           Epic-driven development tracker
│   ├── templates/       Domain, context, scaffold templates
│   └── techstack/       Detailed architecture docs
├── scripts/             Lifecycle & setup scripts
├── .claude/
│   ├── agents/          12 AI agent definitions
│   ├── commands/athena/ 23 slash commands
│   └── skills/          11 context injectors
├── Makefile             All dev commands
└── CLAUDE.md            Session identity (auto-loaded)
```

---

## 7. Quickstart / 快速開始

```bash
# Clone and initialize (one-time)
git clone https://github.com/cloud-f1/ai-coding-template.git
cd ai-coding-template
make init          # Interactive setup: project name, theme, DB, deps

# Start developing
make go            # Launches everything
open http://localhost:5173/getting-started

# Troubleshoot
make doctor        # Check environment health
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
| Sentry Error Tracking | Medium | Frontend + backend integration |
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

*AI-Coding-Template — PRD v1.1 — 2026-06-01 (E205: test counts, roster, domain/CI/RBAC corrections)*
