---
description: "(epic) Orchestrator → read state → execute one step → update progress → exit. Use `auto` to suppress phase pauses."
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

# Epic Loop Orchestrator

You are the Epic Loop controller. Your job is to advance the project **one step of one epic** per invocation. The `/loop` cron re-invokes you — do NOT try to run multiple steps or epics inline.

## Protocol

1. **READ STATE**: Read `docs/context/epic-progress.md` to determine the current step
2. **DETERMINE NEXT**: Find the first epic with an incomplete step (in phase order, respecting dependencies)
3. **LOOKUP DETAILS**: Only if needed for subagent prompt — read `docs/epics/EPIC_INDEX.md` to get epic description
4. **EXECUTE STEP**: Run exactly **ONE step of ONE epic** via subagent delegation:
   - **spec**: Spawn subagent → `/athena:spec "E{n}"`
   - **implement**: Spawn subagent with `isolation: "worktree"` → `/athena:implement`
   - **qa**: Spawn subagent → `/athena:qa`
   - **commit**: Inline — create branch, commit, update docs (lightweight, no subagent needed). After committing, emit the audit event:
     ```bash
     bash scripts/hooks/audit-emit-pipeline.sh commit epic=$EPIC sha=$(git rev-parse --short HEAD) || true
     ```
   - **merge**: Inline — push, create PR, enable auto-merge, update docs (no local checkout needed)
     1. `git push -u origin HEAD`
     2. `gh pr create --title "..." --body "..."` (or find existing PR)
     3. `gh pr merge --squash --delete-branch --auto` — queues merge on GitHub; does NOT checkout main locally
     4. Update epic-progress.md + EPIC_INDEX.md with merge ✅
     5. Do NOT `git checkout main` or `git pull` — the next loop invocation starts fresh
     6. If `--auto` fails (not enabled on repo), fall back to `gh pr merge --squash --delete-branch` but still skip local checkout — just report "merged on remote, run `git pull` to sync"
     7. After GitHub confirms the PR was created/merged, emit the audit event:
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

3. **QA failure pause**: If QA subagent reports coverage < 80% or critical issues, STOP and report.
   Do NOT auto-advance past a failed QA.

4. **Error recovery**: If any step fails, update epic-progress.md with "❌ failed: {reason}" and STOP.
   Do NOT retry the same step automatically.

5. **Mandatory pipeline order**: For each epic, steps MUST execute in order `spec → implement → qa → commit → merge`.
   If `impl=✅` but `qa=⬜`, the next step is `qa` — NOT `commit`. Never go from implement → commit without qa.
   This prevents silently committing untested code when the state file or step-selection logic is buggy.

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
