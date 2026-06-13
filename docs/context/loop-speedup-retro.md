# Loop Speedup Retrospective — Phase 53 Lessons

> **Written**: 2026-06-13  
> **Scope**: Root causes of the slow Phase 53 epic cycle + the framework changes made to prevent recurrence.  
> **Status**: Changes applied — see A–C below.

---

## The 5 Root Causes

### 1. No green baseline → serial bug discovery

Pre-existing breakage was discovered one bug at a time via serial "run → fail → read log → fix → re-run" e2e cycles (each 1–4 min). There was no green baseline at the start of the phase, so every layer had a latent bug found only by building on top of it. Bugs surfaced 5–10 epics late, at maximum debugging cost.

**Pattern**: Epic N works, Epic N+2 fails in a way that's actually Epic N−1's fault.

### 2. Smoke test gave false-green

The Phase 53 smoke test checked HTTP status codes and redirects, not real flows. It reported "6/6 green" while login was 100% broken. The root cause: Auth.js Credentials provider is incompatible with DrizzleAdapter's default database sessions — `auth()` returned null — but a status-code probe never triggered the actual credential check.

**Impact**: login breakage was invisible until late-phase e2e runs.

### 3. QA/loop gates wired to the deleted Python stack

The framework's `qa.md` and `batch.md` were still referencing `cd server && uv run pytest ...` and `cd client && pnpm test:run --coverage` — commands that do not exist in the current Next.js-only repo. The gates never ran; "QA passed" was silently vacuous.

**Impact**: epics got marked `qa=✅` with zero actual test execution.

### 4. Cold dev-server boots + port conflicts wasted cycles

Each "re-run to check if fixed" spun up a new dev server (2–3 min cold boot), sometimes on a conflicting port. Full e2e suite re-runs took 4 min for tests that could have been targeted to 5 seconds with `npx playwright test -g "login"`.

**Impact**: each debug iteration cost 3–4× more time than necessary.

### 5. Independent work done serially when it could be parallel

Epics with no file-scope overlap were dispatched and waited on one at a time. Worktree-isolated parallel dispatch was available but not consistently defaulted. Sequential dispatch of 4 independent implement agents took 4× the elapsed time of a parallel wave.

**Impact**: wave throughput was 1/N of what was achievable.

---

## The Fixes (A–C)

### A. Worktree-parallel execution is now the documented DEFAULT

**Changed**: `.claude/commands/athena/batch.md`

Added a **"Worktree-Parallel Execution"** section that:
- Documents when to use `isolation: "worktree"` (always for parallel implement agents) vs same-tree dispatch (only when file scopes are provably disjoint)
- Gives a concrete N-epic dispatch example with the merge-back/verify sequence
- Clarifies that merge-back is always sequential to avoid merge conflicts

Key rule: **Always use `isolation: "worktree"` for implement agents in a parallel wave.**

### B. Speed & reliability practices codified into loop.md and qa.md

**Changed**: `.claude/commands/athena/loop.md`, `.claude/commands/athena/qa.md`

Both files now have a **"Speed & Reliability Practices (Required)"** section with six rules:

| # | Rule | Addresses root cause |
|---|------|---------------------|
| 1 | Green baseline before feature work — `pnpm build && pnpm test:coverage` at phase start | #1 |
| 2 | Real critical-path smoke — login+dashboard, not just HTTP 200 | #2 |
| 3 | Log-first debugging — read `/tmp/*-dev.log` before guessing | #4 |
| 4 | Warm-server targeted testing — `npx playwright test -g "name" --workers=2` | #4 |
| 5 | Parallel review wave — fan out reviewers, then one "run it" verifier | #5 |
| 6 | Pre-merge gate is mandatory — `scripts/pre-merge-check.sh [--e2e]` | #1, #3 |

### C. Stale stack references replaced

**Changed**: `.claude/commands/athena/batch.md`, `.claude/commands/athena/qa.md`

All references to the old Python/pytest/server stack have been replaced:

| Old (dead) | New (Next.js reality) |
|---|---|
| `cd server && uv run pytest --cov -q` | `cd next-app && pnpm test:coverage` |
| `cd client && pnpm test:run --coverage` | (merged into above; single-stack) |
| Parse `TOTAL ... XX%` from pytest | Parse `All files ... XX%` from vitest |
| `--contract-only` → schemathesis | `--contract-only` → targeted Playwright run |

The documented gate sequence is now the exact commands in `next-app/package.json`:
1. `pnpm typecheck` (tsc --noEmit)
2. `pnpm lint` (ESLint)
3. `pnpm test:coverage` (vitest run --coverage)
4. `pnpm test:e2e` (playwright test — required for auth/Server Action/DB/route epics)

---

## Steady-State Expectation

On a green baseline, a single epic should take approximately **one build+test cycle** to confirm:

- Implement: ~10–20 min (subagent in worktree)
- QA: `pnpm typecheck && pnpm lint && pnpm test:coverage` → ~1–2 min; add `pnpm test:e2e` for auth epics (~3–5 min warm server)
- Total per epic: ~15–30 min

A **wave of 4 parallel epics** in worktrees takes the same ~15–30 min (slowest agent), not 4×. The 3.5 pre-flight probe and 4a-detect backstop ensure parallel dispatch degrades gracefully on machines where worktree isolation is broken.

If a cycle takes >45 min, the likely cause is one of:
- Cold e2e restart (fix: keep dev server warm)
- Full-suite re-run on a known-failing test (fix: target the failing test by name)
- Missing baseline (fix: run `pnpm build && pnpm test:coverage` before phase start)
- Stale gate commands (fix: check `next-app/package.json` scripts)
