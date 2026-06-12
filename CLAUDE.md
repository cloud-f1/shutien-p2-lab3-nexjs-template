# AI Coding Template — Claude Code Session Identity

> **Auto-loaded every session.** Keep concise — essential rules only.
> Full architecture → `TECHSTACK.md` | Last state → `docs/context/session-summary.md`

---

## What This Project Is

A production-ready full-stack SaaS starter (FastAPI + React + PostgreSQL) with an optional AI agent team for automated development via Claude Code.
Epic-driven development — see `docs/epics/EPIC_INDEX.md` for all progress.

## File Layout

```
server/              FastAPI + PostgreSQL (Python 3.12)
client/              React 18 + TypeScript + Vite
docs/
  openapi.yaml       API contract — SINGLE SOURCE OF TRUTH for all types
  epics/             EPIC_INDEX.md — single source of dev progress
  specs/             Feature specs (@spec-writer output) — see specs/CLAUDE.md
  context/           Agent write-back memory — see context/CLAUDE.md
scripts/hooks/       Lifecycle hooks — see hooks/CLAUDE.md
.claude/agents/      12 agent definitions (YAML frontmatter + instructions)
.claude/commands/athena/  23 slash commands (athena namespace) — grouped by epic/planning/memory/ops/ui
.claude/skills/          11 active context injectors (+ 2 tombstone stubs — E210)
scripts/epic-graph.sh    Dependency graph parser + wave planner + tier classifier
```

## Architecture Rules — NEVER DEVIATE

- `openapi.yaml` edited **FIRST** — never write server/client code before the spec
- `server/`: **fastapi-users** for auth — stateless JWT, no custom auth code
- `client/`: access token in `tokenCache.ts` (in-memory) — never localStorage
- React Query: tiers from `cacheConfig.ts` — never hardcode staleTime inline
- Folder names: `server/` and `client/` — never `backend/` or `frontend/`
- UI styling: **primitive-first** — pages compose `client/src/components/ui/` primitives. Visual styling rides on the **Preset axis** (`components/ui/preset.ts`) × **Theme axis** (`styles/themes.css`). No new page-co-located CSS; no new rules in `styles/common/`.

## Testing Rules

- `asyncio_mode = auto` in `pyproject.toml` — no `@pytest.mark.asyncio` needed
- Client tests: `userEvent` not `fireEvent`, MSW handlers in `src/tests/handlers/`
- Coverage gate: **>=80%** both suites — enforced locally (GitHub Actions CI is `workflow_dispatch`-only since 2026-05-20 — see deployment docs)

## Plugin Relationship (E202)

**Template is the canonical upstream source.** `athena-core` is the downstream plugin package. All Athena asset edits (agents, commands, skills, hooks, memory scripts) happen here first; `athena-core` receives changes via one-way sync.

- Run `make drift-check` to detect divergence (exits non-zero if diff found).
- Run `scripts/sync-to-plugin.sh --apply` to export changes to `athena-core` (default: `../athena-core`).
- See `docs/guides/en/plugin-sync.md` for the full sync workflow.

## Deployment

- Platform: Zeabur — server + client as separate services, each with `zbpack.json`
- Migrations on startup: `alembic upgrade head && uvicorn ...`
- `VITE_API_URL` baked at **build time** — set in Zeabur before client build

## Observability Env Vars (E159)

- Server: `SENTRY_DSN_SERVER` — REQUIRED in production (startup fails fast); empty in dev/staging is a silent no-op. `GIT_SHA` becomes the Sentry release tag.
- Client: `VITE_SENTRY_DSN` + `VITE_GIT_SHA` — baked at **build time**, must be set before `pnpm build`. Empty `VITE_SENTRY_DSN` in production logs `console.warn` (does NOT crash).
- Triage: `request_id` is in every server log line and in `x-request-id` response headers. See `docs/guides/en/sre-observability.md`.

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

**Stop verifier** blocks completion if violations detected (23 rules):
localStorage ban, fireEvent ban, staleTime hardcoding, MSW handler location,
folder names, OpenAPI drift, console.log residue, large file warning,
internal mock assertions, parametrize nudge, mock depth limit, test file size,
orphan route, CSS co-location, MSW factory, schema bridge, CSS var drift,
QA gate enforcement (E155), migration review SQL (E157 — Rule #19, requires
`<rev>-*-upgrade.sql` artifact in `docs/context/migration-review/` when
`server/alembic/versions/*.py` changes), OpenAPI contract evidence (E156 —
Rule #20, requires green `qa_contract` audit event when `docs/openapi.yaml`
changes), design-system: no new page CSS (E176 — Rule #21, blocks new files
matching `client/src/pages/**/*.css` — compose `components/ui/` primitives
instead), design-system: no new rules in `styles/common/` (E176 — Rule #22,
blocks added selectors under `client/src/styles/common/*.css` — new CSS
belongs in `components/ui/<Name>.tsx` Preset slots), verification discipline
(E188 — Rule #23, blocks completion-verb commits `feat:` / `fix:` /
`refactor:` / `perf:` / `test:` / `style:` unless a `verification_check`
audit event with `exit=0` exists in the last 10 min — pilot mode gated behind
`STOP_RULE_23_ENABLED=1`; emit via
`scripts/hooks/audit-emit-verification.sh`). See
`scripts/hooks/CLAUDE.md` for the full table.

**Webhook** fires on task completion to `$AI_CODING_WEBHOOK_URL` (Slack/Discord/n8n).
**JSONL audit log** at `.claude/audit.jsonl` — queryable with `jq`.

SessionStart injects active-phase context (~30 lines). PreToolUse guards block
destructive commands and dirty deploys. PostToolUse auto-formats edits.
SubagentStop timestamps write-backs.
All configured in `.claude/settings.json` + agent frontmatter.

---

## Fork 後客製化提示（給 Track B 學員 / 新 fork 者）

如果你 fork 此 repo 開新專案，**這份 CLAUDE.md 需要客製化** — 否則 Claude session 會 follow 原作者的 architecture rules，不是你的。

### 必改

1. **`## What This Project Is`** — 改成你的 project description
2. **File Layout** — 如果你的 stack 不是 React + FastAPI，改 layout
3. **`## Architecture Rules — NEVER DEVIATE`** — 寫**你 codebase** 的 invariants（不是這個 template 的）

### 可保留

- Epic-driven development workflow（如果你也用 epic 管理 dev）
- 「Avoid Known Pitfalls」 pattern
- `.claude/` directory layout convention

### 不要改

- Markdown 結構 / heading hierarchy（保持 Claude Code session 識別格式）
- frontmatter pattern

詳細 fork 流程見 [`docs/zh-tw/getting-started.md`](docs/zh-tw/getting-started.md) Step 4。Track B 5 模組對應導讀見 [`docs/zh-tw/track-b-integration.md`](docs/zh-tw/track-b-integration.md)。
