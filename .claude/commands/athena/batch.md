---
description: "(epic) Parallel epic execution → wave dispatch → auto-fallback to sequential if worktree isolation breaks."
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, CronList, CronDelete
---

# Batch Epic Executor — Parallel Wave Engine

You are the Batch Epic Executor. Your job is to run multiple epics **in parallel** using worktree-isolated agents, respecting the dependency graph computed by `scripts/epic-graph.sh` (E84).

## Argument Parsing

Parse `$ARGUMENTS` for the following flags:

| Argument | Example | Default | Description |
|----------|---------|---------|-------------|
| Epic list | `E82,E83,E84` | (none) | Explicit comma-separated epic IDs |
| `--phase N` | `--phase 25` | (none) | All epics in phase N |
| `--max-concurrent N` | `--max-concurrent 4` | default resolved from `$MAX_CONCURRENT` (exported by `scripts/effort/resolve.sh`); standard tier = 4 | Max parallel agents per wave. Step 3.5 (Pre-flight Worktree Isolation Smoke Test) runs whenever this is `≥ 2` and **auto-falls-back to `1` if your machine's worktree isolation is broken** — so the default is "try parallel; degrade silently." Step 4a-detect catches contamination if smoke passes but real dispatch leaks. |
| `--dry-run` | `--dry-run` | off | Show execution plan without running |
| `--tier A\|B\|C` | `--tier A` | (none) | Filter by tier classification |
| `--step STEP` | `--step implement` | (none) | Run only this step per epic (spec\|implement\|qa\|commit\|merge) |
| `--retry-failed` | `--retry-failed` | off | Re-run only epics marked ❌ from last batch |
| `--max-retries N` | `--max-retries 2` | `2` | Max auto-retry attempts per failed epic (0 = no retry) |
| `--skip-integration-test` | `--skip-integration-test` | off | Skip post-merge integration test gate between waves |
| `auto` | `auto` | off | Auto-pilot: detect pending phase, run ONE wave, exit for cron re-invoke |
| `--effort <tier>` | `--effort quick` | `standard` | `quick\|standard\|thorough\|ultra` — scales fan-out, verification depth, and model tier (default: standard) |

**Parsing rules:**
- Positional argument (no `--` prefix, contains `E` and commas or single `E\d+`) = epic list
- `auto` as first argument = auto-pilot mode (no `--phase` needed)
- If neither epic list, `--phase`, `auto`, nor `--retry-failed` is provided, report error and exit
- `--step` defaults to running all incomplete steps for each epic if omitted

## Step 0: Resolve Effort Tier

```bash
eval "$(./scripts/effort/resolve.sh "$ARGUMENTS" 2>/dev/null || true)"
```

This pre-populates `MAX_CONCURRENT`, `MAX_ITERATIONS`, `REVIEW_LOOP_BUDGET`, `AUTOPILOT_THRESHOLD`, `ATHENA_VERIFY_POSTURE`, and `ATHENA_MODEL_MAP` from the `--effort` flag (or `$ATHENA_EFFORT` env, or default `standard`). Omitting `--effort` is identical to today's behavior.

**Note**: After Step 0, `$MAX_CONCURRENT`, `$MAX_ITERATIONS`, and `$REVIEW_LOOP_BUDGET` are available for the rest of the command. The hardcoded default of `4` for `--max-concurrent` is superseded by what `resolve.sh` exports — `standard` tier exports `MAX_CONCURRENT=4` (byte-for-byte identical to prior behavior), while `ultra` tier scales to `min(16, cores-2)`.

## Context Control (CRITICAL)

The batch command is a **thin orchestrator**. It reads state, computes waves via `epic-graph.sh`, dispatches subagents, collects results, updates state, and exits. This keeps the main context small.

### State vs Catalog Separation

| File | Purpose | When to read |
|------|---------|-------------|
| `docs/context/epic-progress.md` | **State** — IDs + step status only | ALWAYS (Step 1) |
| `docs/epics/EPIC_INDEX.md` | **Catalog** — descriptions, details, full specs | Only when building subagent prompts |

**Rule**: Read epic-progress.md for state. Only touch EPIC_INDEX.md to look up epic details for subagent prompts. Updates go to BOTH files.

### Step Delegation Rules

| Step | Delegation | Why |
|------|-----------|-----|
| spec | `Agent(subagent_type="general-purpose", model=<spec/exec>)` | Spec writing reads many files — isolate |
| implement | `Agent(subagent_type="general-purpose", isolation="worktree", model=<by complexity>)` | Heaviest step — gets its own git worktree |
| qa | `Agent(subagent_type="general-purpose", model=$reviewer)` | Review + test execution reads/runs many files |
| commit | Inline (Bash + Edit) | Just git commands — fast, no subagent needed |
| merge | Inline (Bash) | Push + PR + auto-merge on GitHub — no worktree needed |

**IMPORTANT**: Only spec/implement/qa steps are dispatched to parallel agents. Commit and merge steps run **inline sequentially** after the parallel wave completes.

### Model tiering (task-based — NOT all opus)
Dispatch the agent `model` from `$ATHENA_MODEL_MAP` (Step 0), by step + epic complexity — mirroring the athena agent team (doers like @reviewer/@qa/@debugger = `sonnet`; deep-design like @spec-writer/@best-practice = `opus`):
- **implement** → `execute` from the map for a *simple* epic (S/M size); escalate to `opus` for a *complex* epic (L/XL, or anything touching auth/security/migrations/multi-file features). At `ultra` tier `execute` is already `opus`.
- **qa** → the map's `reviewer` model (haiku at quick, sonnet standard/thorough, opus ultra).
- **spec** → `execute` (sonnet baseline; opus for complex epics).

This keeps the inherited main-loop model (often opus) from being applied blanket to every agent. Read each epic's size from `EPIC_INDEX.md` to classify complexity, same as `/athena:flow` Step 2.

---

## Worktree-Parallel Execution (the DEFAULT for waves)

### Why worktree isolation?

When N epics in a wave each dispatch an `implement` agent, those agents MUST NOT share the same working tree — otherwise they will clobber each other's files (the "Phase 45 Wave 1 incident"). The solution: each `implement` agent gets its own git worktree via `isolation: "worktree"`. Spec and QA agents are read-mostly and do not need worktree isolation; they run in the main tree.

### When to use worktrees vs same-tree dispatch

| Scenario | Mode | Reasoning |
|---|---|---|
| **N independent epics** with potentially overlapping files (default) | `isolation: "worktree"` per implement agent | Agents write to disjoint branches; no clobbering possible |
| **N independent epics** with provably disjoint scopes (e.g. one touches only `app/dashboard/`, another only `app/settings/`) | Same-tree parallel (omit `isolation`) | Cheaper — no worktree overhead; only safe when file scopes are confirmed non-overlapping by reading the specs first |
| **Single epic** | No worktree needed | One agent, no contention |
| **Sequential wave** (fallback after probe failure) | Same-tree, `--max-concurrent 1` | Step 3.5 auto-detects broken worktree isolation and degrades here |

**Default rule**: Always use `isolation: "worktree"` for implement agents in a parallel wave. Only omit it when you have explicitly read both epic specs and confirmed zero file overlap.

### Concrete example: dispatching N epics as parallel worktree agents

Suppose Wave 2 has three independent epics: E83 (dashboard widget), E84 (settings page), E85 (API key management).

**Step 1 — verify scopes are independent** (or just use worktrees regardless):
```bash
# Quick scope check: do any specs mention the same files?
grep -h "next-app/app/\|components/" docs/epics/e83-*.md docs/epics/e84-*.md docs/epics/e85-*.md | sort | uniq -d
# If output is empty → scopes are disjoint; worktrees still recommended for safety
```

**Step 2 — dispatch all three in parallel, each in its own worktree**:
```
# Dispatched concurrently (single message, three Agent tool calls).
# model is chosen per epic complexity (see "Model tiering" above): E83/E84 are M (simple)
# → execute model (sonnet); E85 touches auth/keys (complex) → opus.

Agent(E83, isolation="worktree", model="sonnet"):
  prompt: "Epic E83 (dashboard widget). Step: implement.
           Read CLAUDE.md. Read docs/epics/e83-dashboard-widget.md.
           Implement on branch feat/E83-dashboard-widget.
           Return AgentReport JSON."

Agent(E84, isolation="worktree", model="sonnet"):
  prompt: "Epic E84 (settings page). Step: implement.
           Read CLAUDE.md. Read docs/epics/e84-settings-page.md.
           Implement on branch feat/E84-settings-page.
           Return AgentReport JSON."

Agent(E85, isolation="worktree", model="opus"):
  prompt: "Epic E85 (API key management — complex: auth/secrets). Step: implement.
           Read CLAUDE.md. Read docs/epics/e85-api-key-management.md.
           Implement on branch feat/E85-api-key-management.
           Return AgentReport JSON."
```

Each agent runs in a separate git worktree on a separate branch. They write files independently with no shared state.

**Step 3 — collect results and merge back**:

After all three agents complete (or timeout at 30 min):
1. Run Step 4a-detect (cross-contamination check — confirm each agent reported a different `worktreePath`)
2. For each agent that returned `status: "success"`:
   - Dispatch a QA agent for that epic (NOT in a worktree — QA reads the branch via git)
   - On QA pass: inline commit (the branch already exists in the worktree; `git push` from there)
3. For each agent that returned `status: "failure"` or `status: "blocked"`: mark ❌, skip commit
4. After all commits: run the integration test gate (Step 4c) to verify no cross-epic regressions

**Step 4 — merge-back/verify sequence** (inline, not parallel):
```bash
# For each successfully QA'd epic branch:
git push -u origin feat/E83-dashboard-widget
gh pr create --title "feat(E83): dashboard widget" ...
gh pr merge --squash --delete-branch --auto

# After all PRs merge:
git fetch origin && git reset --hard origin/main

# Integration test (Step 4c):
cd next-app && pnpm typecheck && pnpm lint && pnpm test:coverage && pnpm test:e2e
```

The merge-back is **always sequential** — merging PRs in parallel on GitHub causes merge conflicts. Merge one PR, wait for it to land on `main`, then merge the next.

---

### Mandatory Pipeline Order (NEVER SKIP)

The pipeline for each epic is: `spec → implement → qa → commit → merge`

**QA is MANDATORY after implement.** The batch executor MUST:
1. After an implement agent completes successfully, dispatch a **qa agent** for the same epic
2. The qa agent runs code review + test execution (server ≥80% + client ≥80% coverage)
3. Only after qa passes → proceed to commit
4. If qa fails → mark epic as ❌, do NOT commit

**Enforcement rule:** When checking incomplete steps for an epic:
- If `impl=✅` but `qa=⬜` → next step is `qa` (NOT commit)
- If `impl=⬜` → next step is `implement`
- If `qa=✅` and `commit=⬜` → next step is `commit`
- NEVER go from `implement → commit` without `qa` in between

This prevents the bug where the orchestrator dispatches implement agents, commits immediately on success, and skips QA entirely.

### What the Batch Does NOT Do

- Does NOT read source code files (subagents do that)
- Does NOT run tests directly (subagents do that — except the wave-level integration gate at 4c)
- Does NOT write implementation code (subagents do that)
- ONLY reads state, computes waves, dispatches agents, collects results, updates state, reports

## Protocol

### Step 1: Validate Inputs

1. Read `docs/context/epic-progress.md` to get current state
2. If `auto` mode: run **Auto-Pilot Detection** (see below), then continue to Step 2
3. If `--phase N` specified: extract all epics in that phase
4. If explicit epic list: validate each epic exists in epic-progress.md
5. If `--retry-failed`: scan epic-progress.md for epics with ❌ status, use those as the list
6. If `--tier` specified: will filter after graph computation (tier requires `--classify`)
7. Report error and EXIT if any specified epic ID is not found

#### Auto-Pilot Detection (`auto` mode)

When `auto` is specified:

1. **Find pending phase**: Scan Phase Status table for first phase with status ⬜ Pending (not ✅ Complete)
2. **If no pending phase found**: Cancel all active cron jobs (call `CronList` to get job IDs, then `CronDelete` for each one), report "No pending phases — cron loop stopped. Run `/athena:plan` to propose new epics." and EXIT
3. **Set `--phase` to the detected phase number** — auto fills the `--phase` argument
4. **Read Phase Parallelism** to determine wave structure
5. **Determine current wave**: Check which epics in the phase are already complete (all 5 steps ✅). The next wave = first group of epics whose dependencies are all satisfied
6. **Execute ONE wave only** — not all waves. After the wave completes, EXIT. The cron re-invokes for the next wave.
7. **Phase auto-advance**: When all epics in the current phase reach ✅, auto-detect the next pending phase on the next invocation. No phase boundary pause (auto mode suppresses it, like `/athena:loop auto`).

**Why one wave per invocation**: Keeps each call small (~4 agents max, 10-30 min). Cron handles continuity. If a wave fails, the next invocation picks up cleanly. Context window stays lean.

**Usage with cron**:
```
/loop 2m /athena:batch auto          # parallel auto-pilot
/loop 2m /athena:batch auto --tier B # only Tier B epics
```

### Step 2: Compute Execution Graph

Run the dependency graph script to determine wave ordering:

```bash
./scripts/epic-graph.sh --phase {N} --pending-only --classify --json
```

Or for explicit epic lists, run without `--phase` and filter the output to only include the specified epics.

Parse the JSON output which has this structure:
```json
{
  "nodes": [{"id": "E82", "phase": "25", "completed": false, "tier": "A"}, ...],
  "edges": [{"from": "E84", "to": "E85"}, ...],
  "waves": [{"wave": 1, "epics": ["E82", "E83"]}, {"wave": 2, "epics": ["E85"]}]
}
```

If `--tier` is specified, filter nodes to only include epics matching that tier.

Recompute waves from the filtered set: epics whose dependencies are all outside the filtered set (or already completed) go into wave 1, and so on.

### Step 3: Dry-Run Mode

If `--dry-run` is set, output the execution plan and EXIT without dispatching agents:

```
=== Batch Execution Plan ===

Phase {N} — {total} epics, {wave_count} waves

Wave 1 ({count} parallel): E82 [Tier A], E83 [Tier A], E84 [Tier B]
Wave 2 ({count} parallel): E85 [Tier C], E86 [Tier B]

Step: {step or "all incomplete"}
Max concurrent: {max_concurrent}
Estimated: ~{estimate} min (vs ~{serial_estimate} min serial)

Dependency graph validated: no cycles detected.
```

Also flag any epic that is missing a spec file at `docs/epics/e{n}-{slug}.md`.

Then EXIT.

### Step 3.5: Pre-flight — Worktree Isolation (two-layer probe; Phase 45 hardening)

Run **only when `--max-concurrent ≥ 2`** (i.e. you're about to dispatch parallel implement agents). Skip in single-epic / `auto`-default mode — there's no parallelism to validate.

The Phase 45 Wave 1 incident happened because the Agent tool's `isolation: "worktree"` parameter silently degraded — agents reported `worktreePath: "Worktree ready: unknown"` and wrote into the main worktree. **Two failure layers exist** and Step 3.5 must probe both:

| Layer | Failure mode | Probe |
|---|---|---|
| **Shell** — `git worktree add` | `git worktree` itself broken (rare; permissions / disk / corruption) | shell smoke test (3.5a) |
| **Agent tool** — `isolation: "worktree"` wrapper | Wrapper silently degrades, agent lands in main worktree (Phase 45 incident) | Agent-layer probe (3.5b) |

Shell-layer pass does NOT imply Agent-layer pass — they're independent. Both probes must be green to enable parallel dispatch.

#### 3.5a — Shell-layer smoke test

```bash
# 1. Snapshot existing worktrees + clean working tree precondition
EXISTING_WT=$(git worktree list | wc -l)
DIRTY=$(git status --porcelain | wc -l)
[ "$DIRTY" -ne 0 ] && echo "ABORT: working tree must be clean before parallel dispatch" && exit 1

# 2. Smoke test: create + remove a probe worktree on a throwaway branch
PROBE_BRANCH="probe/wt-smoke-$(date +%s)"
git worktree add /tmp/wt-probe-$$ -b "$PROBE_BRANCH" 2>&1 | tail -2
SHELL_OK=$?
git worktree remove /tmp/wt-probe-$$ --force 2>/dev/null
git branch -D "$PROBE_BRANCH" 2>/dev/null

# 3. If shell smoke fails: degrade to --max-concurrent 1, skip 3.5b
if [ "$SHELL_OK" -ne 0 ]; then
  echo "Shell-layer worktree probe FAILED — falling back to --max-concurrent 1"
  MAX_CONCURRENT=1
  # skip Agent-layer probe; sequential dispatch doesn't need isolation
  return
fi
```

#### 3.5b — Agent-layer probe (catches the Phase 45 failure mode)

Dispatch a tiny read-only Agent with `isolation: "worktree"` and inspect the path it actually runs in. The probe **must return a JSON object** matching the **Step 3.5 Probe Schema** (see below). Freeform responses trigger a retry (max 3 attempts).

```
probe = Agent(
  prompt: "Run pwd, git branch --show-current, and git worktree list.
           Return a JSON object with exactly these fields:
           {
             \"pwd\": \"<output of pwd>\",
             \"branch\": \"<output of git branch --show-current>\",
             \"isolationVerdict\": \"ISOLATED\" or \"SHARED\"
           }
           Set isolationVerdict to ISOLATED if pwd differs from the main repo root
           (i.e. you are in a real worktree, not the main checkout); SHARED otherwise.
           Do NOT write any files.",
  isolation: "worktree",
  subagent_type: "general-purpose"
)
```

## Step 3.5 Probe Schema

The Agent-layer probe (Step 3.5b) must return a JSON object matching this schema:

```json
{
  "pwd": "<absolute path where the probe agent is running>",
  "branch": "<current git branch name>",
  "isolationVerdict": "ISOLATED | SHARED"
}
```

Decision rule — check `probe_result.isolationVerdict`:

```python
if probe_result.isolationVerdict == "SHARED":
    print("Agent-layer worktree probe FAILED — falling back to --max-concurrent 1")
    MAX_CONCURRENT = 1
```

Also fall back to `--max-concurrent 1` if the probe response cannot be parsed as valid JSON (schema mismatch after 3 retries), or if `probe_result.pwd == repo_root`, or if `probe_result.branch == current_branch`.

**No substring matching on freeform text.** The `isolationVerdict` field is a typed enum — `ISOLATED` or `SHARED` — and is the authoritative decision signal. The old freeform substring check (E201: eliminated) has been replaced by this schema-typed field.

When the Agent-layer probe forces `--max-concurrent 1`, emit a `coverage_dropped` audit event so downstream consumers (e.g. `/athena:metrics --effort`) can see that coverage was truncated:

```bash
bash scripts/hooks/audit-emit-coverage-drop.sh batch_concurrency worktree_isolation_broken orchestration || true
```

Cost: ~30k tokens, ~10–15s, 0 files written (pure pwd/git read). Cheap enough to run on every parallel-eligible `/athena:batch` invocation. **Validated empirically on 2026-05-06 — probe correctly returned `SHARED` on the same machine where Phase 45 Wave 1 broke.**

If both 3.5a and 3.5b pass, proceed to Step 4 with `--max-concurrent` as user requested. Step 4a-detect remains the third-line backstop in case both probes miss something.

## Agent Report Schema

All agent step results **MUST** match this schema. Freeform responses trigger a retry (max 3 attempts via the agent prompt). This structurally prevents the QA-skip bug: no code path can advance from `implement → commit` without a schema-valid `qa: status == "success"`.

```json
{
  "status": "success" | "failure" | "blocked",
  "filesChanged": ["<path>", "..."],
  "worktreePath": "<absolute path>",
  "worktreeBranch": "feat/E{n}-{slug}",
  "summary": "<one-line description>"
}
```

When an agent returns a freeform response instead of this JSON object:
1. Retry the agent with an explicit reminder: `"Your response must be a JSON object with keys: status, filesChanged, worktreePath, worktreeBranch, summary. Return only JSON."`
2. After 3 failed attempts: mark the epic as ❌ with reason `"schema_violation: agent returned freeform after 3 retries"`
3. Log to `.claude/audit.jsonl` with `event: "schema_violation"`

### Step 4: Wave Execution Engine

#### Dispatch Posture

Step 0's `resolve.sh` sets `$ATHENA_VERIFY_POSTURE`. This controls which dispatch path Step 4 follows:

| Posture | `ATHENA_VERIFY_POSTURE` value | Dispatch mode |
|---------|-------------------------------|---------------|
| `standard` | unset, `single-vote`, or `quick` | **TODAY'S BEHAVIOR** — sequential wave order, wave barrier (all epics in wave complete before next wave starts), free-text reports accepted (schema validation is advisory), `scripts/reviewer-loop.sh` path. Behavior is byte-for-byte identical to pre-E201 batch behavior. |
| `parallel` | `thorough`, `ultra`, `adversarial-3+perspective`, `judge-panel+adversarial+multimodal` | **WORKFLOW-NATIVE** — `pipeline()` per epic (each independently traverses `spec → implement → qa → commit` with no cross-epic wave barrier), schema-validated reports (freeform = retry), `scripts/qa/verify-panel.sh` path. `parallel()` used **only** at the post-merge integration gate (Step 4c). |

**Default (`standard`)**: All existing `/athena:batch` behavior is unchanged. Passing `--effort thorough` or `--effort ultra` opts into the `parallel` posture.

#### pipeline() Per-Epic Dispatch (parallel posture only)

When `$ATHENA_VERIFY_POSTURE` is `thorough` or `ultra`, each epic in the wave dispatches its own independent pipeline — fast epics reach `commit` while slow siblings are still in `implement`. Total elapsed time = slowest single chain, not sum-of-slowest-per-wave.

```
For each epic E in next wave:
  pipeline(E):
    Stage 1: implement → returns AgentReport schema
    Stage 2: qa       → schema validates impl status == "success"; else pipeline drops E
    Stage 3: commit   → runs only after qa.status == "success" (inline, not subagent)

All epics run independently — fast epics reach commit while slow siblings are in implement.
parallel() gate: after ALL epics in wave finish → run integration test (Step 4c / E91)
```

Pipeline drop rules:
- If Stage 1 (`implement`) returns `status: "failure"` → pipeline drops E; mark epic ❌; do NOT dispatch Stage 2
- If Stage 2 (`qa`) returns `status: "failure"` → pipeline drops E; mark epic ❌; do NOT proceed to Stage 3
- If Stage 2 schema validation fails after 3 retries → pipeline drops E; mark epic ❌ with `"schema_violation"`
- Stage 3 (`commit`) is **unskippable** if both Stage 1 and Stage 2 return `status: "success"` — no code path can advance without it

`parallel()` is reserved exclusively for the post-merge integration gate (Step 4c) where all epics in the wave genuinely must complete before a shared test assertion. No other `parallel()` calls exist in the dispatch path.

**Auto mode**: Execute only the NEXT incomplete wave, then skip to Step 6 (report) and EXIT. The cron re-invokes for the next wave. This keeps each invocation small (~4 agents, 10-30 min).

**Auto-mode concurrency default:** `--max-concurrent` resolved from `$MAX_CONCURRENT` (set by `scripts/effort/resolve.sh`; standard tier = 4) — tries parallel, with the Step 3.5 two-layer probe (shell + Agent-tool) gating actual parallel dispatch. If isolation works on both layers, you get the N× throughput; if either layer is broken, the probe catches it pre-flight and the wave runs sequentially with no implement-agent time wasted (the probe itself is a tiny ~30k-token, <15s read-only Agent). Step 4a-detect is the third-line backstop.

**Normal mode**: Execute ALL waves sequentially.

For each wave (in order, or just the next wave if `auto`):

#### 4a. Dispatch Agents

For each epic in the wave (up to `--max-concurrent` at a time):

1. Read the epic spec file at `docs/epics/e{n}-{slug}.md` (find the matching file via glob `docs/epics/e{n}-*.md`)
2. Read `docs/epics/EPIC_INDEX.md` to get epic metadata (name, size, dependencies)
3. **For spec/implement/qa steps** — dispatch a subagent (see Step Delegation Rules above). Only `implement` uses `isolation: "worktree"`; `spec` and `qa` omit it:

```
Agent(
  prompt: "
    Epic: E{n} ({name})
    Step: {step}
    Size: {size}
    Dependencies: {deps or 'none'}

    Read CLAUDE.md for project rules.
    Read docs/epics/e{n}-{slug}.md for full technical design.
    Then execute the {step} step for this epic.

    When complete, return a JSON object with EXACTLY these fields:
    {
      \"status\": \"success\" or \"failure\" or \"blocked\",
      \"filesChanged\": [\"<path>\", \"...\"],
      \"worktreePath\": \"<absolute path where you ran>\",
      \"worktreeBranch\": \"<current git branch>\",
      \"summary\": \"<one-line description of what was done>\"
    }
    Return ONLY the JSON object. Do not wrap it in prose.
  ",
  isolation: "worktree"  # only for implement step; omit for spec/qa
)
```

4. **After implement succeeds → MUST dispatch qa agent** (same epic, NEVER skip):
   ```
   Agent(
     prompt: "
       Epic: E{n} ({name})
       Step: qa
       Run /athena:qa for this epic.
       Read CLAUDE.md for project rules.
       Read docs/epics/e{n}-{slug}.md for the spec.
       Execute: code review (git diff) + test suites (all from next-app/):
         pnpm typecheck       — TypeScript gate
         pnpm lint            — ESLint gate
         pnpm test:coverage   — Vitest unit tests (≥80% coverage gate)
         pnpm test:e2e        — Playwright e2e REQUIRED for auth/Server Action/DB/route epics
       Write results to docs/context/review-log.md and docs/context/test-status.md.
       Report: pass/fail + coverage numbers.
     "
   )
   ```
   - If qa passes → update epic step to `qa=✅`, proceed to commit
   - If qa fails → mark epic as ❌, do NOT commit, log failure
   - This dispatch is MANDATORY — going from `implement → commit` without `qa` is a protocol violation

5. **For commit/merge steps** — run inline (no subagent), and **fire the TaskCompleted boundary hook** so users with `AI_CODING_WEBHOOK_URL` configured get Slack/Telegram/Discord pings on real epic boundaries (not just on internal Task tool moves):
   - **commit**: Create branch `feat/e{n}-{slug}`, stage changes (use **explicit paths** — never `git add .`/`-A`), commit with conventional message, update state. **Then fire**:
     ```bash
     echo '{"epic_id":"E{n}","step":"commit","status":"completed","duration_seconds":N}' | bash scripts/hooks/task-completed.sh
     bash scripts/hooks/audit-emit-pipeline.sh commit epic=E{n} sha=$(git rev-parse --short HEAD) || true
     ```
   - **merge**: `git push -u origin HEAD`, `gh pr create`, `gh pr merge --squash --delete-branch --auto` (falls back to immediate merge if repo doesn't allow auto-merge — that's normal, not a failure). After GitHub returns merged: **fire**:
     ```bash
     echo '{"epic_id":"E{n}","step":"merge","status":"merged","duration_seconds":N}' | bash scripts/hooks/task-completed.sh
     bash scripts/hooks/audit-emit-pipeline.sh merge epic=E{n} pr=$PR_NUMBER || true
     ```
     Do NOT `git checkout main` locally during merge step. After all wave merges, sync via `git fetch origin && git reset --hard origin/main` (works even when local has divergent commits — those go through their own PR flow).
   - **failure**: when commit/merge fails, fire `step=<current_step>, status=failed` so users see the boundary in real time.

6. If more epics remain in the wave than `--max-concurrent` allows, wait for an agent to finish before dispatching the next one

#### 4a-detect. Cross-Contamination Detection (Phase 45 hardening)

After all parallel agents complete, **before proceeding to commit/merge**, validate the worktree isolation actually held. Skip when `--max-concurrent == 1` (no parallelism, can't cross-contaminate).

Detection signals (any one of these = contamination):

1. **Two or more agents report the same `worktreePath`** (e.g. both report `/Users/.../ai-coding-template`, the main worktree)
2. **Any agent reports `worktreePath: "unknown"`** or `worktreeBranch: undefined`
3. **Working tree on main has more files modified than any single epic touched** — sum each agent's `Files changed` count; if `git status --porcelain | wc -l` > max(per-agent count), files leaked across boundaries
4. **`git worktree list`** shows fewer worktrees than agents dispatched

If contamination detected:

1. **STOP** — do NOT proceed to commit/merge for any epic in the wave
2. Fire boundary hook with `status=blocked` to alert the user
3. Print the **Failure Recovery: Cross-Contamination Untangle** protocol (see below)
4. EXIT with exit code 0 (this is informational, not a hard error — user needs to untangle by hand)
5. On next invocation, the cron will re-enter; if the smoke test still fails, the auto-fallback in Step 3.5 will pick `--max-concurrent 1` and the wave runs sequentially (correctly)

#### 4b. Collect Results

After all agents in the wave complete:

1. Collect each agent's result: status (success/failure), files changed, summary
2. Record results in a local tracking structure
3. If an agent **failed**:
   - Mark the epic as ❌ in `docs/context/epic-progress.md`
   - Log the failure reason
   - **Continue** with remaining independent epics (do NOT stop the batch)
4. If an agent **succeeded**:
   - Update `docs/context/epic-progress.md` with the completed step (✅)
   - Update `docs/epics/EPIC_INDEX.md` to keep catalog in sync

#### 4b-retry. Auto-Retry on Agent Failure (E88)

When an agent fails AND `--max-retries` > 0 (default: 2):

1. **Extract failure info**: Capture the agent's error output (last 50 lines) and exit code
2. **Pattern match**: Check if the error matches a known failure pattern from `docs/context/debug-log.md`:
   - Auth.js returns null session → suggest JWT session strategy (`lib/auth.ts` `strategy: "jwt"`)
   - RBAC guard sees stale role → re-read role from DB in `lib/permissions.ts`
   - Drizzle migration not in `_journal.json` → suggest `pnpm db:generate`
   - Server Action missing `"use server"` → suggest adding the directive
   - Zod message i18n drift → update the test assertion to the current message
   - (See `scripts/hooks/post-bash-failure-inject.sh` for full pattern list)

3. **Circuit breaker check**: Compare current error pattern with previous attempt (if any):
   - If **same root cause** (same pattern ID or same error substring in first 200 chars): **STOP retrying**
   - Mark epic as ❌ with reason: `"circuit breaker: {pattern_name}"`
   - Report: `"Epic E{n} failed twice with same pattern '{pattern}'. Human intervention required."`
   - Continue with other independent epics in the wave

4. **Retry dispatch** (if circuit breaker not triggered):
   - Retry 1: dispatch immediately with enriched prompt
   - Retry 2: wait 30 seconds, then dispatch with enriched prompt
   - Enriched prompt includes:
     ```
     RETRY ATTEMPT {n}/{max_retries} for Epic E{id}

     Previous failure:
     - Exit code: {code}
     - Known pattern match: {pattern_name or "none"}
     - Suggested fix: {fix or "none — requires investigation"}
     - Error output (last 50 lines):
     ```{error_tail}```

     Apply the suggested fix first if a known pattern was matched.
     If no pattern match, investigate the error output.
     Then re-execute the {step} step.
     ```

5. **Track retries**: Append retry info to `docs/context/orchestration-log.md`:
   ```markdown
   | E{n} | {step} | 🔄 retry {attempt} | — | Pattern: {name or "unknown"} |
   ```

6. **Final status**: After all retries exhausted (or circuit breaker), the epic's final status is:
   - ✅ if any retry succeeded
   - ❌ with last error if all retries failed

#### 4c. Post-Merge Integration Test Gate (E91)

After all agents in a wave complete and branches are merged to main, run the integration test gate **unless `--skip-integration-test` is set**:

1. **Pull latest main** to ensure all wave merges are included:
   ```bash
   git checkout main && git pull origin main
   ```

2. **Run full test suite** (Next.js stack — all commands from `next-app/`):
   ```bash
   cd next-app
   pnpm typecheck                 # TypeScript gate
   pnpm lint                      # ESLint gate
   pnpm test:coverage             # Vitest unit tests with coverage
   pnpm test:e2e                  # Playwright e2e (requires dev server; playwright.config has reuseExistingServer)
   ```
   Capture exit code and coverage percentage from each command's output.

   > **Stack note**: This repo is Next.js-only (`next-app/`). The old Python `server/` and
   > React SPA `client/` have been removed. `uv run pytest` and `cd client && pnpm test:run`
   > are dead commands — use the gates above instead. One-shot:
   > `scripts/pre-merge-check.sh [--e2e]` runs all four gates + repo hygiene.

3. **Verify coverage gate** (>= 80% Vitest unit coverage):
   - Parse coverage from vitest output (look for `All files ... XX%`)
   - If below 80%: treat as failure
   - E2E pass/fail is also a hard gate (any Playwright failure = integration test failure)

4. **On PASS**: Log integration test result and proceed to next wave:
   ```
   ✅ Integration test PASSED after Wave {N} merge. coverage: {X}%
   ```

6. **On FAIL**: Halt the pipeline and perform regression detection:
   a. Run `git log --oneline -N` (where N = number of merges in this wave) to identify suspect merges
   b. If only one merge since last green: that epic is the culprit
   c. If multiple merges: report all as suspects
   d. Log to `docs/context/orchestration-log.md`:
      ```
      Integration test FAILED after Wave {N} merge. Suspects: E{x}, E{y}
      Vitest coverage: {X}% | E2E: {exit_code} | typecheck: {exit_code} | lint: {exit_code}
      ```
   e. **STOP** the batch — do NOT proceed to the next wave
   f. Report failure details in the final batch report

7. **Coverage trend tracking**: After each integration test (pass or fail), append coverage data to the orchestration-log entry using this format:
   ```markdown
   | Integration | Wave {N} | ✅ PASS / ❌ FAIL | vitest: {X}% ({+/-delta}), e2e: pass/fail |
   ```
   Delta is computed by comparing with the previous integration test entry in the log. If no previous entry exists, omit the delta.

#### 4d. Between Waves — Merge Conflict Check

Before starting the next wave:

1. Check for merge conflicts from the completed wave's branches
2. If merge conflict detected: **STOP** the batch, report conflicting files, and suggest resolution
3. If no conflicts: proceed to next wave (after integration test gate passes)

### Step 5: Agent Timeout

Each agent has a **30-minute timeout**. If an agent exceeds this:

1. Mark the epic as ❌ with reason "timeout (>30min)"
2. Log to orchestration log
3. Continue with remaining epics in the wave

### Step 6: Final Report

After all waves complete (or batch is stopped), output:

```
=== Batch Execution Report ===

Phase: {N}
Waves completed: {completed}/{total}
Duration: {total_time}

Results:
  ✅ E82 — {summary} ({duration})
  ✅ E83 — {summary} ({duration})
  ❌ E85 — {failure reason} ({duration})

Files changed: {total_file_count} across {epic_count} epics
Failed: {fail_count} epic(s)

{if retries}
Retries: {retry_count} attempted, {retry_success_count} recovered
{end if}
{if integration_test}
Integration Test (Wave {N}):
  Vitest: {status} — coverage {X}% ({+/-delta} from previous)
  E2E (Playwright): {status}
  typecheck/lint: {status}
{end if}
{if failures}
Re-run failed epics with: /athena:batch --retry-failed --phase {N}
{end if}
{if integration_test_failed}
Integration test regression detected after Wave {N}. Suspects: {epic list}
Fix regressions before re-running: /athena:batch --retry-failed --phase {N}
{end if}
{if circuit_breakers}
Circuit breakers tripped: {list of epic IDs + pattern names}
These require human intervention — same root cause failed twice.
{end if}

PROJECT: {complete}/{total} epics · {complete_phases}/{total_phases} phases
NEXT WAVE: {next_wave_epics} | or: Phase complete, run /athena:plan
```

The **PROJECT** line is derived from `docs/context/epic-progress.md` Phase Status table:
- `{complete}` = count of all epic IDs in phases marked ✅ Complete
- `{total}` = count of all epic IDs across all phases
- `{complete_phases}` = count of phases marked ✅ Complete
- `{total_phases}` = count of all phase rows

The **NEXT WAVE** line shows:
- If more waves remain in the current phase: the epic IDs in the next wave
- If the current phase is complete and no more pending phases: `"Phase complete, run /athena:plan"`
- If the current phase is complete but another pending phase exists: `"Phase {N} complete. Next: Phase {M} — run /athena:batch auto"`

### Step 7: Log to Orchestration Log

Append an entry to `docs/context/orchestration-log.md`:

```markdown
### {YYYY-MM-DD HH:MM} — Batch: Phase {N}

| Epic | Step | Status | Duration | Summary |
|------|------|--------|----------|---------|
| E82  | implement | ✅ | 12m | Added webhook handler |
| E83  | implement | ✅ | 8m  | Created batch API |
| E85  | implement | ❌ | 30m | Timeout |

| Integration | Wave {N} | ✅ PASS / ❌ FAIL | — | server: {X}% ({+/-delta}), client: {Y}% ({+/-delta}) |

**Waves**: {completed}/{total} | **Duration**: {total} | **Triggered by**: /athena:batch {args}
```

## Error Handling Summary

| Error | Action |
|-------|--------|
| Epic not found | Report error, EXIT |
| Cycle in dependency graph | Report error, EXIT (script exits with code 1) |
| Agent failure | Auto-retry up to `--max-retries` (default 2), then mark ❌ |
| Agent failure (same pattern twice) | Circuit breaker: mark ❌, escalate to human, continue others |
| Agent timeout (>30min) | Mark ❌ with timeout reason, continue (no retry for timeouts) |
| **Shell-layer probe fails (Step 3.5a)** | **Auto-fallback to `--max-concurrent 1`; do NOT abort. Skips 3.5b.** |
| **Agent-layer probe fails (Step 3.5b — Phase 45 failure mode)** | **Auto-fallback to `--max-concurrent 1`; do NOT abort. Wave runs sequentially, no implement-agent time wasted.** |
| **Cross-contamination detected (Step 4a-detect)** | **STOP wave, fire `status=blocked` hook, print untangle protocol, exit 0. Should be unreachable if 3.5b is honest, but kept as third-line backstop.** |
| **`gh pr merge` "not possible to fast-forward"** | **Cosmetic only — ignore. Server-side merge succeeded; the warning is from gh's local-sync attempt failing because local has divergent commits.** |
| Merge conflict | STOP batch, report conflicting files |
| Integration test failure | STOP batch, report suspects (E91 gate) |
| Coverage below 80% | Treated as integration test failure — STOP batch |
| Missing spec file | Warn in dry-run; in execution, skip epic with ❌ "no spec" |

## Failure Recovery: Cross-Contamination Untangle (Phase 45 Wave 1 incident)

When the cross-contamination detector (Step 4a-detect) fires, multiple parallel agents have written into the **same** working tree on the **same** branch — usually because `Agent(isolation: "worktree")` silently degraded. The branches the orchestrator created (`feat/e{n}-{slug}` per epic) exist locally but have **no commits on them**; all the work is intermingled in `git status` on whichever branch was checked out last.

This is the recovery protocol the user / next operator follows by hand. Do NOT auto-untangle from inside the running batch — the orchestrator's job is to detect, alert, and exit cleanly.

### 1. Inventory

```bash
git status --short --untracked-files=all   # see all 17+ files
git worktree list                          # confirm only one worktree (the contamination signal)
git branch --list "feat/e*"                # confirm branches were created but empty
```

### 2. Categorize files per epic

For each epic in the failed wave, list the files **its** agent claimed to have changed (from the agent's report). Cross-reference with the spec file (`docs/epics/e{n}-{slug}.md`) to catch anything missed.

The remaining files (anything not claimed by any agent) belong to the user's pre-batch main-tree work.

### 3. Untangle by branch

Currently checked out branch is whichever the last parallel agent landed on. For each epic:

```bash
# Switch to that epic's branch (uncommitted changes follow you; harmless if they don't conflict)
git switch feat/e{n}-{slug}

# Stage ONLY this epic's files (explicit paths — never -A or .)
git add path/to/file1 path/to/file2 ...

# Commit
git commit -m "feat(E{n}): <one-line summary>"
```

Repeat for the next epic. After all epics are committed on their respective branches, switch to main:

```bash
git switch main
git status   # only the user's pre-batch main-tree work should remain
```

### 4. QA + push + PR per epic (sequential, NOT parallel)

For each branch:

```bash
git switch feat/e{n}-{slug}
# Run /athena:qa --test-only locally OR rely on CI
git push -u origin feat/e{n}-{slug}
gh pr create --title "feat(E{n}): ..." --body "..."
gh pr merge --squash --delete-branch --auto   # --auto may show a "fast-forward" warning; ignore (server-side merge still succeeds)
```

### 5. Reconcile state on main

After all PRs merge:

```bash
git switch main
git fetch origin
git reset --hard origin/main   # discard any redundant local commits the squash-merges already included
```

Then update `docs/context/epic-progress.md` to flip the merged epics to all-✅, commit, and PR that as a separate `chore(state)` commit (or rebase pull if main is shared).

### 6. Fire missing boundary hooks

If the protocol's automatic boundary firing didn't run during untangle (because you used direct git/gh, not the protocol's commit/merge step), catch up by hand so the user's webhook channel reflects reality:

```bash
for epic in E180 E185; do
  echo "{\"epic_id\":\"$epic\",\"step\":\"merge\",\"status\":\"merged\",\"duration_seconds\":0}" | \
    bash scripts/hooks/task-completed.sh
done
```

### Prevention going forward

- **Step 3.5 two-layer probe (shell + Agent-tool)** runs automatically whenever `--max-concurrent ≥ 2`. If either layer is broken, the wave silently degrades to `--max-concurrent 1` — no implement-agent time wasted (probe is a ~15s read-only dispatch). The Agent-layer probe (3.5b) specifically catches the Phase 45 failure mode where shell `git worktree` works but `Agent(isolation: "worktree")` doesn't.
- **Step 4a-detect** is the third-line backstop: if both probes pass but real dispatch still cross-contaminates, the wave stops before commit/merge and prints this recovery protocol. With 3.5b in place, this should be effectively unreachable.
- **Default behavior is "try parallel; degrade automatically"** — that's the point. Sequential-by-default would make `/athena:batch` indistinguishable from `/athena:loop`. Don't override unless you have a specific reason.
- **`/loop 5m /athena:batch auto`** is the intended cron pattern — the safety nets above make it set-and-forget on any machine, regardless of whether Agent worktree isolation is broken.

## Safety Guards

1. **Never modify files directly** — all implementation is done by worktree-isolated agents
2. **Never skip dependency order** — waves enforce topological ordering
3. **Always update state** — epic-progress.md is updated after each agent completes
4. **Max concurrent limit** — never exceed `--max-concurrent` simultaneous agents
5. **Wave barrier** — all agents in a wave must complete before the next wave starts
6. **Never commit without qa** — `impl=✅` alone is not enough; `qa=✅` is required before `commit`. Going `implement → commit` without a qa agent in between is a protocol violation (see Mandatory Pipeline Order above)
