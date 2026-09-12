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
pnpm db:e2e-setup    # provision the SEPARATE e2e database (drop → create → migrate → seed)
pnpm test:e2e        # Playwright e2e (run db:e2e-setup first; dev server auto-boots locally)
pnpm db:seed         # seed admin@example.com/Admin123! + user@example.com/User123! (dev DB)

# Add a shadcn/ui component (run from next-app/)
npx shadcn@latest add <component-name>
```

> **e2e uses its OWN database — never `saas_dev`.** `pnpm db:e2e-setup` provisions
> `saas_dev_e2e` (drop → create → migrate → seed) and `playwright.config.ts` defaults there.
> This is not cosmetic: e2e migrates and seeds whatever `DATABASE_URL` points at, so when it
> shared `saas_dev` an e2e run reshaped your dev data, and **parallel worktrees migrated one
> database against different branch schemas** — that is how `saas_dev` reached 17 applied
> migrations against 15 repo `.sql` files. The drop is also what makes seeding deterministic:
> `drizzle/seed.ts` skips enrichment when rows already exist, so re-seeding a dirty DB silently
> omits new fixtures and specs fail for reasons unrelated to the code under test.
> Running several worktrees at once? `STACK_NAME=<name> docker compose up -d` gives each its own
> containers — the names are no longer hardcoded singletons.

> **e2e also verifies the target is THIS checkout (E357).** Before any test runs,
> `next-app/e2e/global-setup.ts` calls `/api/health` and compares its `appInstanceId` (a hash of
> the server's project path, unless `APP_INSTANCE_ID` overrides it) against this checkout's own
> id — a mismatch **aborts the whole run**,
> nothing gets tested. Three env vars control it: `APP_INSTANCE_ID` (server-side, pins identity for
> containers/standalone builds where the path is meaningless), `E2E_EXPECTED_APP_INSTANCE_ID`
> (runner-side, accept a specific target id instead of computing one), `E2E_SKIP_TARGET_CHECK=1`
> (runner-side, disables the check entirely — last resort). Full explanation and recipes:
> `docs/context/test-status.md` → "Standing precondition — e2e runs against a VERIFIED target (E357)".

> **Quality gate before merge:** run `scripts/pre-merge-check.sh [--e2e]` from the repo root —
> it checks repo hygiene (no nested `.git`, no accidental mass deletions) + typecheck + lint +
> unit (+ e2e). The athena loop's `merge` step should pass this first. **`make verify` (E322)**
> is the umbrella version — staleness-check + `pre-merge-check.sh` + a non-strict `check:orphans`
> report + `test:int` (gracefully skips without a reachable Postgres) + a dev-docs build — run it
> before pushing per the "Ship discipline" section in `CONTRIBUTING.md`.

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
  README.md                Navigation index — canonical entry point for all docs/
  architecture/            product-overview.md — one-page system shape (stack/auth/non-goals)
  epics/                   EPIC_INDEX.md — single source of dev progress
  specs/                   Feature specs (@spec-writer output)
  reference/               guide-domain-digest.md — sourced domain rules cheat-sheet, fork-fillable
  context/                 Agent write-back memory
  playbooks/               Workflow SOPs (mockup-to-production, etc.)
  _handoff/                Design-handoff bundle convention (project/ + screenshots/)
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
- **CRUD uses modals, never page redirects** (E273) — create/edit open a shadcn `Dialog` (form with an `onSuccess` callback); delete uses `components/confirm-dialog.tsx`. The Server Action **returns success (no `redirect`)** so the modal closes and the list refreshes via `revalidatePath` + `router.refresh()`. Deep-link a modal open with a query param (`?new=1`, `?edit=<id>`). Pattern reference: `app/(dashboard)/dashboard/items/`.
- **List/table views use the reusable `<DataTable>`** (`components/data-table-generic.tsx`) — built-in filter + pagination + page-size — never a hand-rolled `<table>` for record lists. Below `md` it renders a card list via the optional `renderMobileCard` prop (same TanStack instance as the table, one filter/pagination state — E338); `dense`/`chips`/`emptyState` are the other optional, backward-compatible props.
- **Navigation items always go in `next-app/lib/nav.ts`** (E336) — never hardcode a route/label array inside a component (sidebar, mobile tab bar, breadcrumb, command palette).
- **Record detail pages** (E339) use `dashboard/<domain>/[id]/page.tsx` + a sibling `_detail/` folder of child components — `page.tsx` does ALL fetching and authorization (including the IDOR check: a non-owner who isn't admin gets `notFound()`, never `redirect()`), and every `_detail/*` child receives its data as props only — no child imports `db`. CRUD still goes through the existing modal (E273); the detail page is a **reading** surface, not a second editing flow. Pattern reference: `app/(dashboard)/dashboard/items/[id]/`. Most records don't need one — see `docs/playbooks/list-detail-edit.md` for when a detail page is actually warranted.

## Plugin Relationship (E202)

**Template is the canonical upstream source.** `athena-core` is the downstream plugin package. All Athena asset edits (agents, commands, skills, hooks, memory scripts) happen here first; `athena-core` receives changes via one-way sync.

- Run `make drift-check` to detect divergence (exits non-zero if diff found).
- Run `scripts/sync-to-plugin.sh --apply` to export changes to `athena-core` (default: `../athena-core`).

> **⚠ 不要無條件跑 `--apply`（2026-09-12 實測）。** 上面那句「單向同步」已經不成立：
> 58 個兩邊都有、內容不同的檔案裡，**56 個是雙向分歧**（兩邊各有對方沒有的內容），
> 1 個只有下游有（`skills/athena-loop-speedups` —— 模板才是落後的一方），
> 只有 1 個能安全單向推。`scripts/memory/{inject,score,match,half-life-resolve}.sh`
> 更是結構性不同（下游用 `CLAUDE_PLUGIN_ROOT` 定址），覆蓋會直接讓 plugin 失效。
> 先跑不帶 `--apply` 的 dry-run，只同步下游沒有獨有內容的檔案。
> 完整測量與逐檔數字：`docs/context/athena-core-divergence-2026-09-12.md`。

## Deployment

- Platform: Zeabur (primary, Road 1) — `next-app/` as a single service with `zbpack.json`. GCP
  Cloud Run + Cloud SQL is Road 2 — see `make deploy-gcp` + `docs/guides/deployment-gcp.md`.
- **Runtime-vs-build-time env (E322)** — know which bucket a var is in before you go looking for
  "why didn't my env change take effect":
  - **Server-side runtime env** (`SENTRY_DSN`, `DATABASE_URL`, `AUTH_SECRET`, any `ENABLE_*` you
    add without a `NEXT_PUBLIC_` prefix) — read at request time; toggle per-service/env with
    **no rebuild**. Example: `SENTRY_DSN` unset → `instrumentation.ts` is a complete no-op;
    setting it just flips Sentry on for that service, next request.
  - **`NEXT_PUBLIC_*`** (`NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`,
    `NEXT_PUBLIC_ENABLE_DEMO_LOGIN`, `NEXT_PUBLIC_SENTRY_DSN` if you wire client-side Sentry) —
    bake into the JS bundle at **build time**. Changing them in the host's dashboard has **no
    effect until the next build/deploy** — `make image` / `make deploy-gcp` pass these as
    `--build-arg`.
- **Per-env seeding** — dev vs. stg/prd want different data:
  - **dev** — `pnpm db:migrate` then full `pnpm db:seed` (demo accounts + demo data,
    `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true`). This is what `make local-setup` / `docker compose up`
    already do.
  - **stg / prd** — migrate, then seed **only** a real admin + baseline reference data — **never**
    the dev demo seed. This template ships only `db:seed` today (single-tenant dev seed); if your
    fork needs a real stg/prd environment, add two idempotent scripts following this split —
    `db:seed-admin` (one real admin account, no demo data) → `db:seed-baseline` (non-secret
    reference/lookup data every env needs) — and keep `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` unset/false
    there.
  - Promotion direction: `dev` → `stg` → `prd` (merge forward), never backward.
- **Multi-env deploy table** (fill in for your fork — placeholders below):

  | Env | Git branch | Platform / project | URL |
  |---|---|---|---|
  | **dev** | `main` (or `dev`) | Zeabur project `${ZEABUR_PROJECT}` | `https://<dev-url>` |
  | **stg** | `stg` | `${GCP_PROJECT_ID}` / Cloud Run `${GCP_SERVICE_NAME}` | `https://<stg-url>` |
  | **prd** | `main` (tagged release) | `${GCP_PROJECT_ID}` / Cloud Run `${GCP_SERVICE_NAME}` | `https://<prd-url>` |

  See `deploy/.env.deploy.example` for the deploy-time variables behind these placeholders, and
  the `deploy-config` / `zeabur-deploy` skills for the interactive walkthroughs.
- **Version-in-sidebar** — `next-app/lib/branding.ts` exports `APP_VERSION`, read directly from
  `next-app/package.json`'s `version` field (no git-tag↔UI drift possible). Shown as a small muted
  label in the dashboard sidebar footer (`components/app-sidebar.tsx`). Bump `package.json`
  `version` per the SemVer rule in `CONTRIBUTING.md` and it shows up in the UI on the next deploy.

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

## Foundation (Phases 53–57 — 2026-06-13)

> Historical, and still accurate as the shape of the stack. For what is CURRENT, see
> **Active Epic** below and `docs/context/epic-progress.md` (the SSOT).

The Vite SPA (`client/`) + FastAPI (`server/`) stack was **fully migrated to Next.js** under `next-app/`,
then hardened. Shipped to `main` via PRs #1–#8:

- **Phase 53** — shared Zod validations, **RBAC**, account settings, admin panel, Playwright e2e, Vitest.
- **Phase 54** — shadcn **blocks** UI (login-01 / signup-01 / sidebar-01 / dashboard-01) + **Dockerized** local run + athena hardening.
- **Phase 55** — **3-tier RBAC** (admin/editor/viewer) + demo seed; consolidated `docker-compose` (+ mailpit); athena loop speedups (worktree-parallel default).
- **Phase 56** — shadcn **blue preset** (`b1Yn96132`) + full **繁體中文** i18n.
- **Phase 57** — remediated 33 verified audit findings + **task-tiered model dispatch** in `/athena:flow` + `/athena:batch`.

**Run it locally:** `docker compose up --build -d` → http://localhost:3000 (mailpit on :8025). Demo logins:
`admin@example.com / Admin123!` · `editor@example.com / Editor123!` · `viewer@example.com / Viewer123!`.

**Auth gotcha that will bite you:** Auth.js v5 Credentials needs **JWT sessions** (not DrizzleAdapter's
default DB sessions) and RBAC guards **re-read the role from the DB**. See the `nextjs-saas-patterns` skill.

**Key project skills (`.claude/skills/`):** `nextjs-saas-patterns` (stack gotchas), `athena-loop-speedups`
(orchestration practices), `rebrand` (white-label rebranding), `user-guide-builder` (繁中 user manual),
`zeabur-deploy` (Zeabur deploy SOP), `mockup-to-epics` (HTML mockup → UI-ready epics pipeline),
`alignment-audit` (built app ↔ spec coverage audit), `design-sync-roundtrip` (Claude Design ↔
repo round-trip protocol), `new-project` (fork → product wizard; pairs with
`scripts/new-project.sh` + `/athena:new-project`), `security-audit` (Server-Action/RBAC/webhook
attack-surface checklist), `drizzle-migration-safety` (destructive-change + expand-migrate-contract
SOP), `release-versioning` (SemVer → package.json → APP_VERSION → release PR), `spec-first`
(Drizzle+Zod contract-first), `debugging`, `design-system`, `verification-discipline` (Stop Rule
#23 protocol). All skills are directories with `SKILL.md` — loose `.md` files never load. Stale
FastAPI/Vite skills were removed; vendor `next-best-practices` + `vercel-*` remain.

## Active Epic

**Phases 89–90 ✅ Complete (2026-09-12) — backlog drained. 77 phases complete.**

Phase 89 (E367–E371) remediated a `next-app/` product-code review: a draft sales page served
publicly (`/p/[slug]` checked the E333 custom registry and never read `status`, while
`canServeSalesPageRow` returned false for custom and deferred to the registry — **each side
assumed the other owned it**), five owner-scoped writes that audited a no-op (any authenticated
caller could forge an audit row), shadow validators where `sanitizeEvents` silently rewrote a
typo'd event list to `["*"]`, the one unauthenticated action with no rate limit, and four auth
boundary gaps (guest checkout pre-stamped `emailVerified` for an unproven address).

Phase 90 (E372–E375) is what auditing Phase 89 turned up — each item bigger than the epic that
found it. See `docs/context/session-summary.md` for the full account; the three that change how
you work here:

- **`pre-merge-check.sh` now runs `test:int`** (Gate 5b). E370 shipped a defect through FIVE green
  gates because the publish path ran unit tests only — and because the test written alongside it
  mocked `next/headers`, hiding the exact fragility it was meant to cover. **A new test's mocks
  tend to match the new code's assumptions; the pre-existing tests are the ones without that bias.**
- **`AUTH_URL` must match the port you serve on** when running e2e against a warm server you
  started yourself. Auth.js resolves post-login redirects against it and `.env.local` pins `:3000`
  — so on any other port a sibling fork holding `:3000` makes the authenticated specs assert
  against **that** app and pass. `globalSetup` now aborts on the mismatch. (E357 cannot see this:
  it verifies the base URL once, and this redirect leaves the origin mid-test.)
- **VRT baselines are per-machine and gitignored** — the suite cannot detect a regression someone
  else introduced, and that is a deliberate decision for a template every fork rebrands. It warns
  when your baselines are older than `app/` + `components/`.

Rule 26 (E368) is the new stop-verifier rule: an `actions/*.ts` function that does a scoped
`db.update`/`db.delete` **and** writes an audit event must inspect rows-affected. Writing the rule
found the half of the class the review had missed (reported 4, actual 8).

See `docs/epics/EPIC_INDEX.md` for current phase and next action.
Run `/athena:loop` to advance, or `/athena:loop status` to check state.
Run `/athena:batch auto` for cron-friendly autopilot — **tries parallel by default (`--max-concurrent 4`); auto-falls-back to sequential if your machine's worktree isolation is broken**. Step 3.5 (pre-flight smoke test) gates parallel dispatch; Step 4a-detect catches any post-hoc cross-contamination — see `.claude/commands/athena/batch.md`. `/loop 5m /athena:batch auto` is the intended cron-driven pattern.
Per-epic model is **tiered by complexity** (sonnet baseline, opus for complex/ultra) — not blanket Opus; see `scripts/effort/resolve.sh` + `athena-loop-speedups`.

## Agent Team — TONY + 13 specialists

**TONY** (chief-of-staff skill) is the single window — state a goal in plain language and TONY routes it to the right teammate.

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
@integrator       — /athena:integrate: pre-publish wave integration gate — merges a wave's epic branches onto a throwaway branch, runs the full quality gate, attributes any failure as own-epic vs combination-defect (E344)
```

## Slash Commands (athena namespace)

### (entry point)
```
/athena:tony <goal>            TONY chief-of-staff → state a goal in plain language → routed to the right teammate
```

### (epic) — execution pipeline
```
/athena:spec <feature>         Design feature spec OpenAPI-first → @spec-writer
/athena:implement              TDD cycle from spec → red → green → refactor
/athena:qa [--review-only|--test-only|--eval-only]  Quality gate: review + tests + acceptance
/athena:loop [auto|status]     Orchestrator → one step per call → update → exit
/athena:batch [auto|epics]     Parallel wave dispatch → auto-fallback to sequential
/athena:integrate [--phase N]  Pre-publish wave integration gate → merge wave's branches onto a throwaway branch → full gate → attribute own-epic vs combination-defect failures (E344) → @integrator
/athena:autopilot              Confidence-gated auto-advance → spec→impl→qa→commit→merge
/athena:ship [--draft]         Quick publish → review → fix → commit → PR
/athena:pr [--draft]           Full PR pipeline → merge main → lint → test → PR
```

### (planning) — strategy & visibility
```
/athena:plan [mode]            @strategist analysis → epic proposals → human approval gate
/athena:plan brainstorm "<idea>"  Dialogue-driven design → 7-step Q&A → enriched epic file
/athena:plan mockup <path>     Ingest HTML/Claude-Design handoff → UI-ready epics (mockup-to-epics skill)
/athena:approve <phase> [--note] Approve a gated phase → flip 🟡 PROPOSED/⛔ CR-pending → 🟢 APPROVED across all four state surfaces (human-only, never automated)
/athena:align                  UI-surface alignment → built app vs SSOT/epics → Page-View + Feature-Mapping tables + gaps (run after each phase merges)
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
Tier 0 (global):  ~/.claude/template-memory/   cross-project wisdom (file count drifts — `ls ~/.claude/template-memory/*.md | wc -l`)
Tier 1 (project): docs/context/                this project's state (file count drifts — `ls docs/context/*.md | wc -l`)

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

### 推薦做法：使用 new-project 精靈

```bash
bash scripts/new-project.sh          # dry-run：顯示現有 identity + 將做的變更，不修改任何檔案
bash scripts/new-project.sh --apply  # 套用決定性的 identity 替換（product name / repo slug / docs domain）
/athena:new-project "Your Product"   # agent 判斷半段：改寫 CLAUDE.md 身份段、README intro、roles、seed
make new-project                     # 封存 template epics，從 E1 重新開始
```

keep/replace 邊界詳見 [`docs/TEMPLATE-VS-PRODUCT.md`](docs/TEMPLATE-VS-PRODUCT.md)。

### 必改（精靈不會自動處理的部分）

1. **`## What This Project Is`** — 改成你的 project description（`/athena:new-project` 可代勞）
2. **File Layout** — 如果你的 stack 不同，改 layout
3. **`## Architecture Rules — NEVER DEVIATE`** — 寫**你 codebase** 的 invariants

### 可保留

- Epic-driven development workflow
- `.claude/` directory layout convention

詳細 fork 流程見 [`docs/zh-tw/getting-started.md`](docs/zh-tw/getting-started.md) Step 4。Track B 5 模組對應導讀見 [`docs/zh-tw/track-b-integration.md`](docs/zh-tw/track-b-integration.md)。
