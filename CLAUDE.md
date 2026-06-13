# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AI Coding Template (Next.js) — Claude Code Session Identity

> **Auto-loaded every session.** Keep concise — essential rules only.
> Epic progress → `docs/epics/EPIC_INDEX.md` | Last state → `docs/context/session-summary.md`

---

## What This Project Is

A production-ready Next.js SaaS starter template with shadcn/ui, Tailwind CSS v4, and dark-mode theming — paired with an optional AI agent team for automated development via Claude Code.

Stack: **Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui**

## Development Commands

All commands run from `next-app/`:

```bash
pnpm dev          # start dev server (http://localhost:3000)
pnpm build        # production build
pnpm lint         # ESLint (eslint-config-next)
pnpm typecheck    # tsc --noEmit
pnpm format       # prettier --write

# Tests
pnpm test            # Vitest unit tests (lib/validations, lib/is-admin, actions)
pnpm test:coverage   # Vitest with v8 coverage
pnpm test:e2e        # Playwright e2e (needs DB seeded + dev server; webServer auto-boots locally)
pnpm db:seed         # seed admin@example.com/Admin123! + user@example.com/User123! (required for e2e)

# Add a shadcn/ui component (run from next-app/)
npx shadcn@latest add <component-name>
```

> **Quality gate before merge:** run `scripts/pre-merge-check.sh [--e2e]` from the repo root —
> it checks repo hygiene (no nested `.git`, no accidental mass deletions) + typecheck + lint +
> unit (+ e2e). The athena loop's `merge` step should pass this first.

## File Layout

```
next-app/
  app/                     Next.js App Router — pages and layouts
    layout.tsx             Root layout: fonts + ThemeProvider
    page.tsx               Homepage
    globals.css            Global styles + Tailwind CSS v4 directives
  components/
    ui/                    shadcn/ui components (generated, do not hand-edit)
    theme-provider.tsx     next-themes wrapper + keyboard shortcut (d → toggle dark)
  hooks/                   Custom React hooks
  lib/
    utils.ts               cn() — clsx + tailwind-merge helper
  next.config.ts           Next.js config
  tsconfig.json            Path alias: @/* → next-app root
docs/
  epics/                   EPIC_INDEX.md — single source of dev progress
  specs/                   Feature specs (@spec-writer output)
  context/                 Agent write-back memory
scripts/hooks/             Lifecycle hooks — see hooks/CLAUDE.md
.claude/agents/            Agent definitions (YAML frontmatter + instructions)
.claude/commands/athena/   Slash commands (athena namespace)
scripts/epic-graph.sh      Dependency graph parser + wave planner
```

## Architecture Rules — NEVER DEVIATE

- **Default to Server Components** — only add `"use client"` when you need browser APIs, event handlers, or React state/hooks.
- **Path alias** `@/*` resolves to `next-app/` root (not `src/`) — no relative `../../` imports.
- **shadcn/ui components live in `components/ui/`** — add via `npx shadcn@latest add`, never hand-author them there.
- **Theme system** uses Tailwind `dark:` variants + `next-themes` class strategy. Toggle is `components/theme-provider.tsx`. Do not add inline `style=` color overrides.
- **`cn()` for all conditional Tailwind classes** — never raw string concatenation.
- New route groups: use `(group)/` folders to isolate layouts (e.g., `(auth)/`, `(dashboard)/`).
- Server-side data fetching: fetch directly in async Server Components; use Server Actions for mutations (`"use server"`).

## Plugin Relationship (E202)

**Template is the canonical upstream source.** `athena-core` is the downstream plugin package. All Athena asset edits (agents, commands, skills, hooks, memory scripts) happen here first; `athena-core` receives changes via one-way sync.

- Run `make drift-check` to detect divergence (exits non-zero if diff found).
- Run `scripts/sync-to-plugin.sh --apply` to export changes to `athena-core` (default: `../athena-core`).

## Deployment

- Platform: Zeabur — `next-app/` as a single service with `zbpack.json`
- `NEXT_PUBLIC_*` env vars baked at **build time** — set in Zeabur before build

## Effort Tiers (E198)

Pass `--effort <tier>` to any athena command to scale cost vs depth. Resolved by `scripts/effort/resolve.sh` — precedence: `--effort flag` > `$ATHENA_EFFORT` env > default `standard`.

| Knob | quick | **standard** | thorough | ultra |
|---|---|---|---|---|
| `MAX_CONCURRENT` | 1 | **4** | 4 | min(16,cores-2) |
| `MAX_ITERATIONS` | 1 | **4** | 6 | 8 |
| `REVIEW_LOOP_BUDGET` | 15000 | **50000** | 150000 | 500000 |
| `AUTOPILOT_THRESHOLD` | 0.80 | **0.85** | 0.90 | 0.95 |
| reviewer model | haiku | **sonnet** | sonnet | opus |
| evaluator model | sonnet | **sonnet** | opus | opus |

`standard` is byte-identical to today's hardcoded values — omitting `--effort` changes no current behavior.

## Active Epic

See `docs/epics/EPIC_INDEX.md` for current phase and next action.
Run `/athena:loop` to advance, or `/athena:loop status` to check state.
Run `/athena:batch auto` for cron-friendly autopilot — **tries parallel by default (`--max-concurrent 4`); auto-falls-back to sequential if your machine's worktree isolation is broken**. Step 3.5 (pre-flight smoke test) gates parallel dispatch; Step 4a-detect catches any post-hoc cross-contamination — see `.claude/commands/athena/batch.md`. `/loop 5m /athena:batch auto` is the intended cron-driven pattern.

## Agent Team (12 agents)

```
@spec-writer      — /athena:spec: new feature or endpoint design
@reviewer         — /athena:qa --review-only: read-only code review + security audit
@qa               — /athena:qa --test-only: test execution + 80% coverage gate
@evaluator        — /athena:qa --eval-only: independent acceptance evaluation (E147)
@best-practice    — architecture questions, trade-off decisions
@debugger         — errors, failing tests (auto-delegated)
@deployer         — /athena:deploy: 7-gate protocol, Zeabur
@memory-curator   — /athena:promote: extract wisdom to Tier 0
@strategist       — /athena:plan: audit, research, propose epics (human gate)
@orchestrator     — /athena:batch: parallel epic coordination, dependency waves
@designer         — /athena:design: design tokens → React page (TSX + CSS + smoke test)
@dba              — /athena:dba: migration review, schema design, DB forensics
```

## Slash Commands (athena namespace)

### (epic) — execution pipeline
```
/athena:spec <feature>         Design feature spec OpenAPI-first → @spec-writer
/athena:implement              TDD cycle from spec → red → green → refactor
/athena:qa [--review-only|--test-only|--eval-only]  Quality gate: review + tests + acceptance
/athena:loop [auto|status]     Orchestrator → one step per call → update → exit
/athena:batch [auto|epics]     Parallel wave dispatch → auto-fallback to sequential
/athena:autopilot              Confidence-gated auto-advance → spec→impl→qa→commit→merge
/athena:ship [--draft]         Quick publish → review → fix → commit → PR
/athena:pr [--draft]           Full PR pipeline → merge main → lint → test → PR
```

### (planning) — strategy & visibility
```
/athena:plan [mode]            @strategist analysis → epic proposals → human approval gate
/athena:plan brainstorm "<idea>"  Dialogue-driven design → 7-step Q&A → enriched epic file
/athena:cycle                  Full DevOps cycle → brainstorm → approve → execute → cooldown
/athena:audit                  Three-source drift check → OpenAPI ↔ server ↔ client
/athena:metrics [--memory|--agent]  Read-only audit metrics → agent reliability or memory dashboard
/athena:dashboard              Read-only pipeline dashboard → audit log + progress view
```

### (memory) — knowledge pipeline
```
/athena:learn [--batch N]      Refresh MEMORY.md accuracy → detect drift → suggest promote
/athena:promote [--dry-run]    Promote [GENERALIZABLE] lessons → Tier 0 → NEW_PROJECT_PRIMER.md
/athena:forget                 Archive weak Tier 0 lessons → _archive/ (Ebbinghaus brake)
/athena:save                   Checkpoint all agents → write context docs → commit
/athena:load                   Load project context → summarize state (session start)
```

### (ops) — infrastructure & quality ops
```
/athena:deploy [env]           Deploy to Zeabur → 7 pre-deploy gates → blocks on failure
/athena:dba [cmd]              DB admin → inspect migrations → lint → diagnose → fix
/athena:domain <NAME>          Scaffold new domain → server + 6 client files from templates
/athena:qa-report              QA-to-Epic pipeline → analyze bugfix-log → epic proposals (human gate)
```

### (ui) — frontend generation
```
/athena:design <slug> "<desc>" Generate React page → design tokens + @designer → TSX + CSS
```

## Memory System

```
Tier 0 (global):  ~/.claude/template-memory/   cross-project wisdom (15 files)
Tier 1 (project): docs/context/                this project's state (16 files)

"Update your document" → agent writes to its designated doc
/athena:save           → all agents checkpoint simultaneously
/athena:promote        → @memory-curator extracts lessons → Tier 0

Memory-aware brainstorm (E189): /athena:plan brainstorm reads Tier 0 lessons
scored by match.sh + Tier 1 grep → injects relevant past lessons as design
considerations before the dialogue begins. Emits tier0_loaded {context:"brainstorm"}.
```

## Hooks (auto-run, see scripts/hooks/CLAUDE.md)

**Stop verifier** blocks completion if violations detected. Key rules for this Next.js stack:
- No `console.log` residue in committed code
- No inline `style=` color overrides (use Tailwind + `dark:` variants)
- No hand-authored files in `components/ui/` (use `npx shadcn@latest add`)
- Verification discipline (E188 — Rule #23): blocks `feat:`/`fix:`/`refactor:`/`perf:`/`test:`/`style:` commits unless a `verification_check` audit event with `exit=0` exists in the last 10 min (gated behind `STOP_RULE_23_ENABLED=1`; emit via `scripts/hooks/audit-emit-verification.sh`)

See `scripts/hooks/CLAUDE.md` for the full rule table.

**Webhook** fires on task completion to `$AI_CODING_WEBHOOK_URL` (Slack/Discord/n8n).
**JSONL audit log** at `.claude/audit.jsonl` — queryable with `jq`.

SessionStart injects active-phase context. PreToolUse guards block destructive commands.
All configured in `.claude/settings.json` + agent frontmatter.

---

## Fork 後客製化提示（給 Track B 學員 / 新 fork 者）

如果你 fork 此 repo 開新專案，**這份 CLAUDE.md 需要客製化** — 否則 Claude session 會 follow 原作者的 architecture rules，不是你的。

### 必改

1. **`## What This Project Is`** — 改成你的 project description
2. **File Layout** — 如果你的 stack 不同，改 layout
3. **`## Architecture Rules — NEVER DEVIATE`** — 寫**你 codebase** 的 invariants

### 可保留

- Epic-driven development workflow
- `.claude/` directory layout convention

詳細 fork 流程見 [`docs/zh-tw/getting-started.md`](docs/zh-tw/getting-started.md) Step 4。Track B 5 模組對應導讀見 [`docs/zh-tw/track-b-integration.md`](docs/zh-tw/track-b-integration.md)。
