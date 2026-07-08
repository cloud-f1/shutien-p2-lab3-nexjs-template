# Docs

Developer and project documentation for AI Coding Template.

> **Start here.** Every folder below has a single purpose. When adding new docs, pick the right folder and add a row if you create a new top-level folder.

---

## Folder Index

| Folder / File | Purpose | Status |
|---|---|---|
| [epics/](epics/EPIC_INDEX.md) | Epic pipeline — EPIC_INDEX.md is the single source of dev progress | Live |
| [context/](context/session-summary.md) | Agent write-back memory — session state, decisions, logs | Live |
| [specs/](specs/) | Feature specs produced by `@spec-writer` (`/athena:spec`) | Live |
| [techstack/](techstack/README.md) | Deep-dive tech reference — server, client, deployment, agents, nextjs | Live |
| [reference/](reference/) | Agent team catalog, commands, skills, parallel-pipeline strategy | Live |
| [dev-guide/](dev-guide/README.md) | Developer how-tos — getting started, testing, API guide, deployment | Live |
| [qa/](qa/test-strategy.md) | QA process — test-pyramid audit + versioned manual-test-plan (human-judgment layer) | Live |
| [playbooks/](playbooks/mockup-to-production.md) | End-to-end runbooks — step-by-step workflows for recurring ops | Live |
| [deployment/](deployment/) | Ops runbooks — canary deploy, error budget, secret rotation | Live |
| [design/](design/) | Design system, CSS architecture, Claude Design enrichment notes | Live |
| [diagrams/](diagrams/) | System architecture diagrams and visual references | Live |
| [visuals/](visuals/) | Agent team mindmap, domain diagrams | Live |
| [assets/](assets/) | Static assets (images, SVGs) used in docs | Live |
| [releases/](releases/) | Release notes per version | Live |
| [guides/](guides/) | User-facing guides (quickstart, rebrand, deployment, i18n) | Live |
| [zh-tw/](zh-tw/) | Traditional Chinese documentation (Track B / 繁體中文) | Live |
| [templates/](templates/) | Reusable doc templates (scaffold, test-plan) | Live |
| [archive/](archive/) | Historical specs, plans, presentations, superpowers (read-only) | Archive |
| [PRD.md](PRD.md) | Product Requirements Document | Live |
| [roadmap.md](roadmap.md) | High-level product vision (not execution tracking) | Live |
| [openapi.yaml](openapi.yaml) | OpenAPI spec for Route Handlers | Live |

---

## Key Entry Points

| What you need | Where to go |
|---|---|
| Current epic phase + next action | [epics/EPIC_INDEX.md](epics/EPIC_INDEX.md) |
| Resume a session | [context/session-summary.md](context/session-summary.md) |
| Tech stack overview | [techstack/README.md](techstack/README.md) |
| Agent team reference | [reference/agents.md](reference/agents.md) |
| Getting started | [dev-guide/README.md](dev-guide/README.md) |
| Mockup → production workflow | [playbooks/mockup-to-production.md](playbooks/mockup-to-production.md) |
| Canary deploy / rollback | [deployment/canary-deploy.md](deployment/canary-deploy.md) |
| Error budget / SLO | [deployment/error-budget.md](deployment/error-budget.md) |
| Context budget rules | [reference/context-budget.md](reference/context-budget.md) |
| Traditional Chinese docs | [zh-tw/](zh-tw/) |

---

## Rules

- **One row per folder** — before adding a new top-level folder, add a row to the table above.
- **No new top-level folders without updating this index** — keep this file the authoritative map.
- `docs/context/` is agent-owned — don't restructure it manually.
- `docs/epics/EPIC_INDEX.md` is orchestrator-owned — don't edit the state columns manually.
- Archive-status folders (`archive/`) are read-only historical records.
