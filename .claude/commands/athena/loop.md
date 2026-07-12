---
description: "(epic) Orchestrator → read state → execute one step → update progress → exit. Use `auto` to suppress phase pauses."
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

# Epic Loop Orchestrator

You are the Epic Loop controller. Your job is to advance the project **one step of one epic** per invocation. The `/loop` cron re-invokes you — do NOT try to run multiple steps or epics inline.

## Protocol

1. **READ STATE**: Read `docs/context/epic-progress.md` to determine the current step
1a. **RECONCILE PENDING MERGES (runs first, every invocation)**: For any epic whose merge cell in `docs/context/epic-progress.md` is `⏸ awaiting human merge (PR #N)`, run `gh pr view N --json state`:
   - **MERGED** → `bash scripts/state/state-update.sh E{n} merge done` (flips the cell to ✅ in epic-progress.md and syncs EPIC_INDEX.md via render-index.sh — primary mechanism; fall back to manually editing both files only if the script errors), and sync local main via `git fetch origin && git reset --hard origin/main` (never `git checkout main && git pull`).
   - **CLOSED** (unmerged) → `bash scripts/state/state-update.sh E{n} merge failed --note "PR closed unmerged"` and STOP for human input.
   - **OPEN** → leave `⏸` as-is; the human hasn't merged yet. Do not re-push or re-open.
1b. **STALL BREAKER**: Before dispatching the chosen epic+step, query `.claude/audit.jsonl` — if the SAME `epic`+`step` has recorded a failure in the last 3 loop invocations, STOP: `bash scripts/state/state-update.sh E{n} {step} failed --note "blocked: {step} failed 3x - human required"` (fall back to manually editing epic-progress.md if the script errors) and EXIT. Do not auto-retry a repeatedly-failing step.
2. **DETERMINE NEXT**: Find the first epic with an incomplete step (in phase order, respecting dependencies).
   **Reconcile from the actual state matrix, not a presumed linear history.** For the chosen epic, the next step is the **first `⬜` cell** scanning `spec → implement → qa → commit → merge` left-to-right. Steps already at ✅ are *done* — never re-run them, even if an earlier step is ⬜ (out-of-order / retro-spec case; see "Out-of-Order Work" below).
   **If no incomplete step exists across ANY epic in ANY phase** (all work is done): report "All phases complete — backlog drained. Please stop the `/loop` schedule yourself. Run `/athena:plan` to propose new epics." and EXIT. (This orchestrator cannot cancel cron jobs — it has no such tool. The human owns the schedule.)
3. **LOOKUP DETAILS**: Only if needed for subagent prompt — read `docs/epics/EPIC_INDEX.md` to get epic description
4. **EXECUTE STEP**: Run exactly **ONE step of ONE epic** via subagent delegation:
   - **spec**: Spawn subagent → `/athena:spec "E{n}"`
   - **implement**: Spawn subagent with `isolation: "worktree"` → `/athena:implement`
   - **qa**: Spawn subagent → `/athena:qa`
   - **commit**: Inline — create branch, commit, update docs (lightweight, no subagent needed). After committing, emit the audit event:
     ```bash
     bash scripts/hooks/audit-emit-pipeline.sh commit epic=$EPIC sha=$(git rev-parse --short HEAD) || true
     ```
   - **merge**: Inline — run the **Publish step** below. Default: push branch + open PR + **auto-merge** after the mandatory gates. With `ATHENA_AUTO_MERGE=0` the publish step stops at `⏸ awaiting human merge` and the USER merges (see the canonical block).
5. **UPDATE STATE**: `bash scripts/state/state-update.sh $EPIC $STEP $STATUS` — the primary mechanism for flipping the step cell (writes epic-progress.md, syncs EPIC_INDEX.md via render-index.sh, emits its own `state_update` audit event). Fall back to manually editing both `docs/context/epic-progress.md` and `docs/epics/EPIC_INDEX.md` only if the script errors. Then emit the loop-step observability event:
   ```bash
   bash scripts/hooks/audit-emit-pipeline.sh loop_step epic=$EPIC step=$STEP status=$STATUS || true
   ```
6. **REPORT**: Show what was done and what's next — then **EXIT**

## Publish step — CANONICAL (auto-merge by default; opt-out human-merge)

> This is the single canonical definition of the "publish" (formerly "merge") step for the entire
> athena pipeline. `batch.md`, `flow.md`, `ship.md`, and `pr.md` all reference this block.
> **Default: AUTO-MERGE (user-authorized 2026-07-13).** After the mandatory gates pass, step 4
> below merges the PR automatically via `gh pr merge`.
>
> Preconditions are non-negotiable: the epic must have `qa=✅` (mandatory QA gate) and the
> PRE-PUBLISH GATE (step 1) must pass — auto-merge changes WHO clicks merge, never WHAT gets
> merged. The post-merge integration gate still runs. On any merge failure (conflict / branch
> protection / API error) fall back to `⏸ awaiting human merge` — never force.
>
> **HUMAN-MERGE MODE (opt-out)**: set `ATHENA_AUTO_MERGE=0` (env) or pass `--no-auto-merge` to
> stop at push + PR: write `⏸ awaiting human merge (PR #N)` and let the USER merge; a later
> invocation reconciles via Step 1a.

1. **PRE-PUBLISH GATE (MANDATORY — runs BEFORE `git push`)**: Run the repo-hygiene + quality gate and **ABORT the publish if it exits non-zero**.
   ```bash
   # Add --e2e when the epic touches auth, Server Actions, the DB, or routes.
   # (heuristic: epic spec mentions login/session/auth, "use server"/actions/,
   #  prisma/drizzle/migration/schema, or app/ route/route handler changes)
   if scripts/pre-merge-check.sh ${E2E_FLAG:-}; then
     echo "pre-merge-check passed — proceeding to push"
   else
     echo "❌ pre-merge-check FAILED — aborting publish for $EPIC"
     exit 1
   fi
   ```
   - Set `E2E_FLAG=--e2e` for epics touching **auth / Server Actions / DB / routes**; leave it empty otherwise.
   - On non-zero exit: `bash scripts/state/state-update.sh $EPIC merge failed --note "merge blocked: pre-merge-check failed"` (fall back to manually editing epic-progress.md if the script errors) and STOP. Do **NOT** `git push` or open a PR. The half-migrated-tree class of bug (uncommitted mass deletions, nested `.git`) is exactly what this gate catches.
2. **Push the feature branch**: `git push -u origin HEAD`
3. **Open a PR if none exists** (capture the PR number):
   ```bash
   PR=$(gh pr list --head "$(git branch --show-current)" --json number --jq '.[0].number')
   [ -z "$PR" ] && PR=$(gh pr create --title "..." --body "..." | grep -oE '[0-9]+$')
   ```
4. **Merge cell update — mode-dependent**:
   - **Default (AUTO-MERGE)**:
     ```bash
     if gh pr merge "$PR" --merge; then
       bash scripts/state/state-update.sh $EPIC merge done --note "auto-merged PR #$PR"
       git fetch origin && git pull --ff-only   # sync local main to the merged state
       bash scripts/hooks/audit-emit-pipeline.sh auto_merge epic=$EPIC pr=$PR || true
     else
       # conflict / branch protection / API failure → degrade to human-merge, never force
       bash scripts/state/state-update.sh $EPIC merge awaiting-merge --note "PR #$PR (auto-merge failed — human required)"
     fi
     ```
   - **HUMAN-MERGE MODE (`ATHENA_AUTO_MERGE=0`)**: write `⏸ awaiting human merge (PR #N)` via
     `bash scripts/state/state-update.sh $EPIC merge awaiting-merge --note "PR #$PR"` (primary
     mechanism; fall back to manually editing both state files only if the script errors).
5. **Emit the publish audit event**:
   ```bash
   bash scripts/hooks/audit-emit-pipeline.sh publish epic=$EPIC pr=$PR || true
   ```
6. **EXIT** — in default (auto-merge) mode the pipeline continues directly to the next step/wave
   (integration gate included); in human-merge mode the USER merges and a later invocation
   reconciles via Step 1a.

## Context Control (CRITICAL)

The loop command is a **thin orchestrator**. It reads state, delegates ONE step to a subagent, updates state, and exits. This keeps the main context small so `/loop` can run indefinitely.

### State vs Catalog Separation

| File | Purpose | When to read |
|------|---------|-------------|
| `docs/context/epic-progress.md` | **State** — IDs + step status only | ALWAYS (Step 1) |
| `docs/epics/EPIC_INDEX.md` | **Catalog** — descriptions, details, full specs | Only when spawning subagent (Step 3) |

**Rule**: The loop reads epic-progress.md for state. It only touches EPIC_INDEX.md to look up epic details for the subagent prompt. Updates go to BOTH files (state + catalog).

### Subagent Delegation Rules

| Step | Delegation | Why |
|------|-----------|-----|
| spec | `Agent(subagent_type="general-purpose")` | Spec writing reads many files — isolate from loop context |
| implement | `Agent(subagent_type="general-purpose", isolation="worktree")` | Heaviest step — gets its own git worktree + full context window |
| qa | `Agent(subagent_type="general-purpose")` | Review + test execution reads/runs many files |
| commit | Inline (Bash + Edit) | Just git commands — fast, no context bloat |
| merge | Inline (Bash) | Publish protocol: push + open PR; default = auto-merge after gates, `ATHENA_AUTO_MERGE=0` = EXIT for human merge (canonical block) |

### What the Loop Does NOT Do

- Does NOT read source code files (subagents do that)
- Does NOT run tests (subagents do that)
- Does NOT write implementation code (subagents do that)
- Does NOT inline QA review (subagents do that)
- ONLY reads epic-progress.md, optionally looks up EPIC_INDEX.md, runs one subagent, updates state, reports

### Subagent Prompt Template

For Phase 46+ epics the spec already exists (output of `/athena:plan brainstorm` via `brainstorm-emit.sh render-epic`). The loop reads it as-is — no re-spec needed.

When spawning a subagent for spec/implement/qa, provide this context with inline epic details (avoids subagent needing to read the full EPIC_INDEX.md):

```
Epic: E{n} ({name})
Step: {step}
Size: {size}
Description: {inline the epic description from EPIC_INDEX.md}
Dependencies: {list or "none"}

Read CLAUDE.md for project rules.
Read docs/epics/EPIC_INDEX.md for epic E{n} details.
Read the epic spec at docs/epics/e{n}-{slug}.md for full technical design.
Then execute the {step} step for this epic.
```

The loop inlines basic epic metadata so the subagent has immediate context. The subagent reads the full spec file for detailed implementation instructions.

## Dependency Check

Read the **Dependency Rules** section in `docs/context/epic-progress.md`.
Verify ALL listed dependencies have all 5 steps at ✅ status.
If dependencies aren't met, skip to the next eligible epic in the same phase, or report "phase blocked."

## Phase Parallelism

Read the **Phase Parallelism** section in `docs/context/epic-progress.md`.
Prefer the listed order when multiple epics are eligible.

## Out-of-Order Work (Retro-Spec)

The pipeline is normally linear (`spec → implement → qa → commit → merge`), but work sometimes lands out of order — **Phase 53 was implemented before it was spec'd** during the Vite/FastAPI → Next.js migration. The loop must handle a state matrix where a *later* step is ✅ while an *earlier* step is still ⬜.

**Rules:**

1. **State matrix is the source of truth, not step order.** Trust the ✅/⬜ cells in `docs/context/epic-progress.md`, not an assumption that earlier steps always complete first.
2. **Never re-run a ✅ step.** If `implement=✅` already, do not re-implement — even when `spec=⬜`. Re-running a completed step risks clobbering finished work.
3. **Retro-spec = fill the gap, don't redo the future.** When an earlier step is ⬜ but a later one is ✅ (e.g. `spec=⬜, implement=✅`), run the *earlier* step as a **retro-spec**: write the spec to **document what was actually built** (reverse-engineer from the implementation), rather than designing greenfield. Then mark it ✅ and let the next invocation pick up the next ⬜ cell.
4. **Selection algorithm (unchanged for the linear case):** next step = first ⬜ scanning `spec → implement → qa → commit → merge`. This naturally yields retro-spec when an early cell is the only gap.
5. **QA/commit/merge still gate normally.** A retro-spec does not exempt the epic from QA (≥80% coverage) or the pre-merge gate. After back-filling spec, the loop proceeds through any remaining ⬜ steps in order.

**Example (Phase 53):**

| Epic | spec | implement | qa | commit | merge |
|------|------|-----------|----|----|----|
| E53  | ⬜   | ✅        | ⬜ | ⬜ | ⬜ |

Next step = `spec` (first ⬜), executed as a **retro-spec** documenting the already-built migration. The loop does NOT re-run `implement`. After spec ✅, subsequent invocations run `qa → commit → merge`.

## State Update Rules

After completing a step, use `bash scripts/state/state-update.sh E{n} {step} {status} [--note "..."]` as the
primary mechanism — it updates `docs/context/epic-progress.md` and syncs the matching row in
`docs/epics/EPIC_INDEX.md` via `render-index.sh` in one call, eliminating the dual-write-drift
failure mode of hand-editing both files. Fall back to manually editing both files only if the
script errors (unknown epic, invalid step/status, etc.).

## Auto-Pilot Safety Guards

1. **One step per invocation**: Execute ONE step of ONE epic, then EXIT.
   The `/loop` cron will re-invoke you for the next step. Do NOT chain steps.

2. **Phase boundary pause**: When ALL epics in a phase reach "merge ✅", STOP and report:
   "Phase {N} complete. Review before continuing. Run `/athena:loop` for next phase."
   Also include: "Consider running `/athena:learn --batch` to capture lessons from this phase."
   Do NOT auto-advance to the next phase.
   **Exception — `auto` flag**: Phase boundary pause is suppressed; advance to the next pending phase automatically. However, if ALL phases are complete (no pending phase exists), report "backlog drained — please stop the `/loop` schedule yourself" and EXIT (this orchestrator has no cron-cancel tool; the human owns the schedule).

3. **QA failure pause**: If QA subagent reports coverage < 80% or critical issues, STOP and report.
   Do NOT auto-advance past a failed QA.

4. **Error recovery**: If any step fails, `bash scripts/state/state-update.sh E{n} {step} failed --note "{reason}"` (fall back to manually editing epic-progress.md if the script errors) and STOP.
   Do NOT retry the same step automatically.

5. **Mandatory pipeline order**: For each epic, steps MUST execute in order `spec → implement → qa → commit → merge`.
   If `impl=✅` but `qa=⬜`, the next step is `qa` — NOT `commit`. Never go from implement → commit without qa.
   This prevents silently committing untested code when the state file or step-selection logic is buggy.
   **Exception — retro-spec (out-of-order work):** an epic may have been *implemented before it was spec'd* (Phase 53 was done this way). The pipeline-order rule reconciles against the **actual state matrix**, not a presumed linear history: pick the first `⬜` step in `spec → implement → qa → commit → merge` order and run *that* one. If a later step is already ✅ while an earlier one is ⬜ (e.g. `implement=✅` but `spec=⬜`), the loop fills in the earlier step (a "retro-spec" that documents what was built) and must **never re-run an already-✅ step**. See "Out-of-Order Work (Retro-Spec)" below.

6. **Pre-merge gate is blocking**: The `merge` step runs `scripts/pre-merge-check.sh` (with `--e2e` for auth/Server-Action/DB/route epics) BEFORE `git push`. On non-zero exit, write `❌ merge blocked: pre-merge-check failed` to epic-progress.md and STOP. Do NOT push or open a PR on a failed gate.

---

## Speed & Reliability Practices (Required)

These rules were extracted from the Phase 53 retrospective. Each one addresses a real failure mode that caused multi-cycle debug loops. They are **required steps**, not suggestions.

### 1. Green baseline before feature work

**Rule**: At the start of any new phase, before dispatching implement agents, confirm the baseline is green:
```bash
cd next-app
pnpm build && pnpm test:coverage
# For phases touching auth/DB/routes — also run:
pnpm test:e2e
```
A regression then shows in 1 cycle (immediately after the epic that broke it). Without a green baseline, every layer has a latent bug found only by building on top of it — bugs surface 5–10 epics late, at maximum debugging cost.

**Signal**: If `pnpm build` fails before any epic work, do NOT proceed. File a baseline-fix epic and resolve it first.

### 2. Smoke the real critical path, not just status codes

**Rule**: Before stacking features on top of auth, verify real login works — a human (or Playwright test) must actually land on the dashboard:
```bash
# Real smoke: the test must log in and assert dashboard content, not just check HTTP 200
pnpm test:e2e -- --grep "login"
```
A status-code probe returns 200 even when login is completely broken (the page redirects to an error page that returns 200). This failure mode was the root cause of Phase 53's invisible login breakage. The smoke test in `scripts/pre-merge-check.sh --e2e` exercises the real flow.

### 3. Log-first debugging — read before guessing

**Rule**: On any test/build failure, read the server log BEFORE re-running or guessing at a fix:
```bash
# Dev server log (if running in background):
cat /tmp/*-dev.log 2>/dev/null | tail -50

# Build log:
pnpm build 2>&1 | tail -30

# E2E failure trace (Playwright writes to playwright-report/):
cat next-app/playwright-report/index.html | head -100
# or: open next-app/playwright-report/index.html
```
Re-running without reading the log just burns a 1–4 min cycle and lands back at the same error. Reading the log takes 10 seconds and usually reveals the exact line and module.

### 4. Warm-server targeted testing — avoid cold full-suite re-runs

**Rule**: Keep one dev server running. Run targeted tests against it; avoid cold full-suite restarts.
```bash
# Keep the server warm (start once, leave running):
cd next-app && pnpm dev > /tmp/next-dev.log 2>&1 &

# Run a single test by name (fast — no cold boot, no unrelated tests):
npx playwright test -g "login and reach dashboard" --workers=2

# Run a specific test file:
npx playwright test e2e/auth-flow.spec.ts --workers=2
```
`playwright.config` already has `reuseExistingServer: true` and a 120s boot timeout — Playwright will attach to the already-running server automatically. A targeted 1-test run takes ~5s. A cold full-suite re-run takes 2–4min.

**Signal for full-suite**: Only run the full `pnpm test:e2e` when all targeted tests pass and you're at the pre-merge gate. The pre-merge gate (`scripts/pre-merge-check.sh --e2e`) is the right place for that.

### 5. Parallel review wave — fan out, then verify

**Rule**: QA for a wave fans out independent reviewers per epic dimension, then runs a mandatory "execute the real flow" step:
- Dispatch `@reviewer` agents for code review in parallel across epics (they are read-only and independent)
- After all reviews complete, dispatch one verifier that actually runs `pnpm test:e2e` against the combined change set
- A review that only reads code is not sufficient for auth/Server Action/DB/route epics — see the "must actually run it" rule in `/athena:qa`

### 6. Pre-merge gate is mandatory — reference

`scripts/pre-merge-check.sh [--e2e]` must exit 0 before any merge. This is already wired into Safety Guard #6 above and the merge step protocol. The gate runs:
- repo hygiene (no nested `.git`, no mass uncommitted deletions)
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (unit, Vitest)
- `pnpm test:e2e` (only with `--e2e` flag)

Add `--e2e` whenever the epic touches auth, Server Actions, DB queries, or route handlers.

---

## Arguments

$ARGUMENTS — optional:
- `status` — show current state without executing
- `skip-to E{n}` — jump to a specific epic
- `auto` — suppress phase-boundary pause (full auto-pilot, use with caution)
- `dry-run` — show what WOULD be executed without doing it
- `--effort <tier>` — `quick|standard|thorough|ultra` — scales fan-out, verification depth, and model tier (default: standard)

**Step 0 — Resolve effort tier:**
```bash
eval "$(./scripts/effort/resolve.sh "$ARGUMENTS" 2>/dev/null || true)"
```
