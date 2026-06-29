# Project readiness index — agents, skills, commands, context

> **Start here to get oriented.** This is the single map of *how this project works*: the AI dev
> team (agents), the skills they use, the commands that drive them, and where the project's memory
> lives. For *what the product is*, see [`/CLAUDE.md`](../../CLAUDE.md); for *dev progress*, see
> [`../epics/EPIC_INDEX.md`](../epics/EPIC_INDEX.md). Last updated: 2026-06-30.

---

## 1. The product (one line)
**AI Coding Template (Next.js)** — a production-ready Next.js SaaS starter with shadcn/ui, Tailwind CSS v4,
dark-mode theming, Auth.js v5 JWT sessions, 3-tier RBAC, Drizzle/Postgres, and a built-in AI agent team for
automated epic-driven development via Claude Code.
Demo logins: `admin@example.com / Admin123!` · `editor@example.com / Editor123!` · `viewer@example.com / Viewer123!`.

## 2. The AI dev team (agents)
You talk to **TONY** (Chief of Staff = the main thread + the `chief-of-staff` skill); TONY routes
your plain-language goal to the right teammate. Full chart + deliverables:
[`agent-org-chart.md`](./agent-org-chart.md) · visual: [`agent-team.html`](./agent-team.html).

| Persona | Agent ID | Dept | Does | Command |
|---|---|---|---|---|
| **TONY** | *(main thread)* | Chief of Staff | routes a goal → the right teammate; reports back | `chief-of-staff` skill |
| **ATLAS** | strategist | Plan | epic proposals, audits, roadmap | `/athena:plan` |
| **SAGE** | best-practice | Plan | architecture decisions, trade-offs | (architecture Q&A) |
| **PENNY** | spec-writer | Build | feature specs + acceptance criteria | `/athena:spec` |
| **VERA** | designer | Build | TSX + CSS + smoke test | `/athena:design` |
| **DOC** | debugger | Build | root-cause + patch (auto-delegated) | (auto) |
| **ARGUS** | reviewer | Guard | code review + security | `/athena:qa --review-only` |
| **QUINN** | qa | Guard | tests + 80% coverage gate | `/athena:qa --test-only` |
| **JUDE** | evaluator | Guard | independent acceptance verdict | `/athena:qa --eval-only` |
| **PORTER** | deployer | Ship | 7-gate Zeabur source-build deploy + CI/deploy health | `/athena:deploy` |
| **DELTA** | dba | Data | migration review, schema | `/athena:dba` |
| **REMI** | memory-curator | Brain | promote lessons → Tier 0 | `/athena:promote` |
| **MAX** | orchestrator | Field cmd | parallel epic waves | `/athena:batch` |

> Personas are a **display layer over stable `name:` ids** — commands and auto-delegation use the
> ids, so the human names never break routing. Definitions: `.claude/agents/`.

## 3. The skills
Auto-loaded context injectors. Full catalog with triggers: [`skills.md`](./skills.md). The ones you
reach for most:
- **`nextjs-saas-patterns`** — the stack's gotchas (JWT auth, RBAC re-read, DataTable/modals, Docker, i18n).
- **`chief-of-staff`** — TONY's routing playbook.
- **`zeabur-deploy`** — deploy to Zeabur (standard source-build).
- **`rebrand` · `user-guide-builder` · `alignment-audit` · `mockup-to-epics`** — product lifecycle.
- **`athena-loop-speedups`** — orchestration practices for worktree-parallel epics.

## 4. The commands (athena namespace)
Driven by TONY, or run directly. Catalog in [`/CLAUDE.md`](../../CLAUDE.md) § "Slash Commands".
- **Execute:** `/athena:spec` → `/athena:implement` → `/athena:qa` → `/athena:loop` | `/athena:batch` | `/athena:ship`.
- **Plan:** `/athena:plan [research|audit|brainstorm|mockup]` → human approval gate.
- **Audit/align:** `/athena:audit` (data-layer drift) · `/athena:align` (UI ↔ SSOT).
- **Memory:** `/athena:save` · `/athena:learn` · `/athena:promote` · `/athena:load`.
- **Ops:** `/athena:deploy` · `/athena:dba` · `/athena:domain`.

## 5. The memory (where state lives)
- **Tier 1 (this project):** [`../context/`](../context/) — one log per agent (spec/review/test/decisions/
  debug/deploy/…). Index + rules: [`../context/CLAUDE.md`](../context/CLAUDE.md). Resume point:
  [`../context/session-summary.md`](../context/session-summary.md).
- **Tier 0 (cross-project):** `~/.claude/template-memory/` — curated by REMI via `/athena:promote`.
- **Progress:** [`../epics/EPIC_INDEX.md`](../epics/EPIC_INDEX.md).
- **Docs map:** [`../README.md`](../README.md).

## 6. Deploy & ops readiness
- **Local:** `docker compose up --build -d` → http://localhost:3000 (mailpit on :8025).
- **Quality gate:** `scripts/pre-merge-check.sh [--e2e]` (typecheck · lint · unit · e2e); CI runs Quality/DB/Docs checks.
- **Deploy:** Zeabur standard source-build — `next-app/` as a single service with `zbpack.json`.
  Set `NEXT_PUBLIC_*` env vars in Zeabur before build (baked at build time). Use the `zeabur-deploy` skill.

## 7. How to pick up work smoothly (readiness checklist)
1. Read `session-summary.md` (resume point) + `EPIC_INDEX.md` (what's next).
2. State your goal to **TONY** in plain language → it routes.
3. Build/guard via the athena pipeline; **never auto-merge** (human gate) and **confirm before deploy**.
4. Deploy via `zeabur-deploy` skill — standard source-build path.
5. Capture lessons: agents append to their `docs/context/` log; `/athena:promote` lifts `[GENERALIZABLE]` ones to Tier 0.
