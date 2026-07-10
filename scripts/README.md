# scripts/ — Scripts Inventory

All scripts run from the **repo root** unless noted otherwise.
Quick access: `make help` lists all Makefile-backed targets.

---

## Epic Pipeline

| Script | Purpose |
|--------|---------|
| `epic-graph.sh` | Parse `epic-progress.md` dependency rules into a DAG, compute execution waves (topological sort), and classify epics into Tier A/B/C. Used by `/athena:batch` for parallel dispatch. |
| `pre-merge-check.sh` | Repo-sanity + quality gate the athena loop must pass before `merge`: no nested `.git`, no mass deletions, typecheck + lint + unit (+ e2e with `--e2e`). |
| `new-domain.sh` | Scaffold a new CRUD domain by copying the canonical `items` domain and renaming it. Used by `make new-domain NAME=<name>` and `/athena:domain`. |
| `new-project.sh` | _(added in E312)_ Archive template epics to `_archive/` and reset to a clean E1 starting state for fork teams. |
| `template-reset.sh` | One-time post-clone cleanup: removes project-specific history and prepares the template for a new project. |
| `autopilot.sh` | Harness for `/athena:autopilot` — confidence-gated auto-advance through spec→impl→qa→commit→merge. |
| `reviewer-loop.sh` | Iterative reviewer convergence loop — re-runs review until all findings are resolved or budget exhausted. |

---

## Code Quality

| Script | Purpose |
|--------|---------|
| `hooks/stop-verifier.sh` | Stop Hook Verifier — blocks Claude task completion if rule violations are found in changed files (no `console.log`, no inline `style=` colors, etc.). |
| `check-doc-versions.sh` | Detect stale version references in documentation (package versions, Node versions, etc.). |
| `check-translations.sh` | Validate that `en` and `zh-TW` i18n namespaces have identical key sets. |
| `visuals-mindmap-verify.sh` | Compare hardcoded stats in `docs/visuals/agent-team-mindmap.html` against live counts (agents / commands / hooks / stop rules). |
| `smoke.sh` | Comprehensive "is everything OK?" gate — build / test / e2e / registry / VitePress (+ `--vrt` for visual). (Superseded the old `smoke-test.sh`, removed 2026-07-10.) |
| `checks/check-context-budget.sh` | Check context document sizes against memory budget limits. |
| `checks/css-var-check.sh` | CSS Variable Drift Guard — detect undefined CSS custom properties in the app. |
| `align/surface-check.cjs` | Deterministic UI-surface alignment linter for the Next.js app (used by `/athena:align`). |
| `check-orphan-exports.mjs` | _(added in E314)_ Detect exported symbols that are never imported anywhere in the codebase. |
| `service-map.cjs` | _(added in E314)_ Generate a dependency map of all services and their consumers. |

---

## Database

| Script | Purpose |
|--------|---------|
| `db-backup.sh` | Backup PostgreSQL from the Docker container to `backups/`. |

---

## Deploy

| Script | Purpose |
|--------|---------|
| `install-deploy-tools.sh` | One-command quick-start for the deploy toolchain: installs/verifies Zeabur plugin + CLI; checks `gcloud`/`node`/`pnpm`/`docker`. |
| `doctor-deploy.sh` | Platform-specific deploy prerequisites checker. Usage: `bash scripts/doctor-deploy.sh [zeabur|cloudrun]`. |
| `deploy-preview.sh` | Deploy a preview environment for a PR. Usage: `deploy-preview.sh <pr-number>`. |

---

## Docs

| Script | Purpose |
|--------|---------|
| `staleness-check.sh` | Scan `docs/` and `CLAUDE.md` for embedded numbers (test counts, migration counts, phase numbers) that may have drifted from reality. Advisory only — exit 0 always. |
| `screenshot-refresh.sh` | Re-capture Playwright screenshots used in documentation. Requires a running dev server at `http://localhost:3000`. |
| `sync-to-plugin.sh` | One-way sync: template → `athena-core` plugin package. Dry-run by default; pass `--apply` to write. |
| `changelog.sh` | Generate changelog from git tags using `git-cliff`. Pass `--dev-docs` to update the VitePress developer docs section. |
| `archive-context.sh` | Context log auto-compact + auto-promotion pipeline (E160). |

---

## Dev Tools

| Script | Purpose |
|--------|---------|
| `effort/resolve.sh` | Effort Tier Resolver (E198) — resolves `--effort` flag → `$ATHENA_EFFORT` → default `standard`; outputs `MAX_CONCURRENT`, `MAX_ITERATIONS`, reviewer model, etc. |
| `test-designer.sh` | Smoke test for the `@designer` agent scaffolding (E163). |
| `docker-clean.sh` | Docker cleanup with confirmation prompt — prunes containers, images, and optionally volumes. |
| `confidence/spec.sh` | Confidence scorer for the SPEC step (E164) — rates spec completeness before advancing. |
| `confidence/implement.sh` | Confidence scorer for the IMPLEMENT step (E164). |
| `confidence/qa.sh` | Confidence scorer for the QA step (E164). |
| `confidence/commit.sh` | Confidence scorer for the COMMIT step (E164). |
| `memory/match.sh` | Lesson cue-match scorer — ranks Tier 0 memory lessons against a query (E182). |
| `memory/inject.sh` | Selective SessionStart cued-recall injector — injects relevant lessons into context (E182). |
| `memory/score.sh` | Lesson strength score using decay + reinforcement model (E181). |
| `memory/forget.sh` | `/athena:forget` archive engine — identifies weak lessons by Ebbinghaus decay (E184). |
| `memory/metrics.sh` | Memory Metrics Dashboard — shows Tier 0/1 health at a glance (E186). |
| `memory/brainstorm-retrieve.sh` | Memory-aware planning retrieval orchestrator for `/athena:plan brainstorm` (E189). |
| `memory/consolidation-detect.sh` | Detect duplicate or overlapping Tier 0 lessons for consolidation (E190). |
| `memory/backfill-half-life.sh` | One-time backfill of `half_life_days` frontmatter on Tier 0 memory files (E185). |
| `memory/half-life-resolve.sh` | Resolve effective half-life for a memory file (E185). |
| `memory/migrate-strength.sh` | One-time migration: add `strength` frontmatter fields to Tier 0 files (E181). |
| `memory/promotion-follow-through.sh` | Detect premature promotion — lessons promoted before they are reinforced (E183). |
| `plan/brainstorm-emit.sh` | Atomic write helper for `/athena:plan brainstorm` — safely emits structured output. |
| `qa/verify-panel.sh` | Workflow-native QA Verification Panel — runs verification suite and emits panel output (E200). |
| `state/check-drift.sh` | Drift detector — compares `EPIC_INDEX.md` vs `epic-progress.md` for state mismatches (E196). |
| `state/render-index.sh` | Render `EPIC_INDEX.md` from `epic-progress.md` — re-generates the master tracker (E196). |

---

## Lifecycle Hooks (`hooks/`)

These run automatically via Claude Code hooks configured in `.claude/settings.json`.

| Script | Trigger | Purpose |
|--------|---------|---------|
| `hooks/session-start.sh` | SessionStart | Inject active-phase context into the session. |
| `hooks/stop-verifier.sh` | Stop | Block completion if rule violations detected. |
| `hooks/stop-notify.sh` | Stop | Desktop notification when Claude finishes (macOS). |
| `hooks/pre-bash-guard.sh` | PreToolUse(Bash) | Block destructive shell commands. |
| `hooks/pre-deploy-guard.sh` | PreToolUse(Bash) | Block deploy commands outside `@deployer`. |
| `hooks/post-bash-log.sh` | PostToolUse(Bash) | Append every bash command to `.claude/audit.jsonl`. |
| `hooks/post-bash-failure-inject.sh` | PostToolUse(Bash) | Detect bash failures and inject debug context (E88). |
| `hooks/post-edit-lint.sh` | PostToolUse(Edit) | Auto-lint after file edits. |
| `hooks/post-test-coverage-gate.sh` | PostToolUse(Bash) | Enforce 80% coverage gate after test runs. |
| `hooks/post-commit-bugfix-log.sh` | PostToolUse(Bash) | Auto-log bugfix commits to `docs/context/bugfix-log.md`. |
| `hooks/post-debug-verify.sh` | PostToolUse(Bash) | Log verification result after `@debugger` runs a command. |
| `hooks/subagent-stop-writeback.sh` | SubagentStop | Stamp agent doc + session-summary.md on subagent completion. |
| `hooks/task-completed.sh` | TaskCompleted | Fire webhook to `$AI_CODING_WEBHOOK_URL` (Slack/Discord/n8n). |
| `hooks/user-prompt-submit.sh` | UserPromptSubmit | Detect write-back requests and inject memory context. |
| `hooks/worktree-setup.sh` | (worktree init) | Set up a new git worktree with correct environment and docs. |
| `hooks/context-health-monitor.sh` | PostToolUse | Monitor context document health after tool use (E145). |
| `hooks/debug-backup-pre-edit.sh` | PreToolUse(Edit) | Back up file before `@debugger` edits it. |
| `hooks/auto-promote-check.sh` | Stop | Check for lessons ready for Tier 0 promotion. |
| `hooks/audit-emit-pipeline.sh` | (pipeline steps) | Emit pipeline-boundary events to `.claude/audit.jsonl`. |
| `hooks/audit-emit-coverage-drop.sh` | (test runs) | Emit `coverage_dropped` events to `.claude/audit.jsonl`. |
| `hooks/audit-emit-verification.sh` | (verify steps) | Emit `verification_check` events to `.claude/audit.jsonl` (E188 Rule #23). |
| `hooks/pr-created.sh` | (PR creation) | Auto-label, assign reviewers, add epic context comment on new PRs. |
