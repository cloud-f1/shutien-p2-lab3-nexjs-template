---
description: "(epic) Orchestrator → read state → execute one step → update progress → exit. Use `auto` to suppress phase pauses."
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, CronList, CronDelete
---

# Epic Loop Orchestrator

You are the Epic Loop controller. Your job is to advance the project **one step of one epic** per invocation. The `/loop` cron re-invokes you — do NOT try to run multiple steps or epics inline.

## Protocol

1. **READ STATE**: Read `docs/context/epic-progress.md` to determine the current step
2. **DETERMINE NEXT**: Find the first epic with an incomplete step (in phase order, respecting dependencies).
   **Reconcile from the actual state matrix, not a presumed linear history.** For the chosen epic, the next step is the **first `⬜` cell** scanning `spec → implement → qa → commit → merge` left-to-right. Steps already at ✅ are *done* — never re-run them, even if an earlier step is ⬜ (out-of-order / retro-spec case; see "Out-of-Order Work" below).
   **If no incomplete step exists across ANY epic in ANY phase** (all work is done): call `CronList` to find active cron jobs, call `CronDelete` on each, then report "All phases complete — cron loop stopped. Run `/athena:plan` to propose new epics." and EXIT.
3. **LOOKUP DETAILS**: Only if needed for subagent prompt — read `docs/epics/EPIC_INDEX.md` to get epic description
4. **EXECUTE STEP**: Run exactly **ONE step of ONE epic** via subagent delegation:
   - **spec**: Spawn subagent → `/athena:spec "E{n}"`
   - **implement**: Spawn subagent with `isolation: "worktree"` → `/athena:implement`
   - **qa**: Spawn subagent → `/athena:qa`
   - **commit**: Inline — create branch, commit, update docs (lightweight, no subagent needed). After committing, emit the audit event:
     ```bash
     bash scripts/hooks/audit-emit-pipeline.sh commit epic=$EPIC sha=$(git rev-parse --short HEAD) || true
     ```
   - **merge**: Inline — pre-merge gate, push, create PR, enable auto-merge, update docs (no local checkout needed)
     1. **PRE-MERGE GATE (MANDATORY — runs BEFORE `git push`)**: Run the repo-hygiene + quality gate and **ABORT the merge if it exits non-zero**.
        ```bash
        # Add --e2e when the epic touches auth, Server Actions, the DB, or routes.
        # (heuristic: epic spec mentions login/session/auth, "use server"/actions/,
        #  prisma/drizzle/migration/schema, or app/ route/route handler changes)
        if scripts/pre-merge-check.sh ${E2E_FLAG:-}; then
          echo "pre-merge-check passed — proceeding to push"
        else
          echo "❌ pre-merge-check FAILED — aborting merge for $EPIC"
          # Record the failure in state and STOP (do NOT push). See Safety Guard #6.
          exit 1
        fi
        ```
        - Set `E2E_FLAG=--e2e` for epics touching **auth / Server Actions / DB / routes**; leave it empty otherwise.
        - On non-zero exit: update epic-progress.md with `❌ merge blocked: pre-merge-check failed` and STOP. Do **NOT** `git push`, create a PR, or queue auto-merge. The half-migrated-tree class of bug (uncommitted mass deletions, nested `.git`) is exactly what this gate catches.
     2. `git push -u origin HEAD`
     3. `gh pr create --title "..." --body "..."` (or find existing PR)
     4. `gh pr merge --squash --delete-branch --auto` — queues merge on GitHub; does NOT checkout main locally
     5. Update epic-progress.md + EPIC_INDEX.md with merge ✅
     6. Do NOT `git checkout main` or `git pull` — the next loop invocation starts fresh
     7. If `--auto` fails (not enabled on repo), fall back to `gh pr merge --squash --delete-branch` but still skip local checkout — just report "merged on remote, run `git pull` to sync"
     8. After GitHub confirms the PR was created/merged, emit the audit event:
        ```bash
        bash scripts/hooks/audit-emit-pipeline.sh merge epic=$EPIC pr=$PR_NUMBER || true
        ```
5. **UPDATE STATE**: Update `docs/context/epic-progress.md` with the completed step
6. **REPORT**: Show what was done and what's next — then **EXIT**

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
| merge | Inline (Bash) | Push + PR + auto-merge on GitHub — no local checkout needed |

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

After completing a step, update **both** files:
1. `docs/context/epic-progress.md` — update the step emoji in the matrix
2. `docs/epics/EPIC_INDEX.md` — update the matching row (keeps catalog in sync)

## Auto-Pilot Safety Guards

1. **One step per invocation**: Execute ONE step of ONE epic, then EXIT.
   The `/loop` cron will re-invoke you for the next step. Do NOT chain steps.

2. **Phase boundary pause**: When ALL epics in a phase reach "merge ✅", STOP and report:
   "Phase {N} complete. Review before continuing. Run `/athena:loop` for next phase."
   Also include: "Consider running `/athena:learn --batch` to capture lessons from this phase."
   Do NOT auto-advance to the next phase.
   **Exception — `auto` flag**: Phase boundary pause is suppressed; advance to the next pending phase automatically. However, if ALL phases are complete (no pending phase exists), still self-cancel cron jobs (via Step 2 idle check above) and EXIT.

3. **QA failure pause**: If QA subagent reports coverage < 80% or critical issues, STOP and report.
   Do NOT auto-advance past a failed QA.

4. **Error recovery**: If any step fails, update epic-progress.md with "❌ failed: {reason}" and STOP.
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
