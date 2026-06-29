# `/athena:flow` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive-only `/athena:flow` slash command that drains the epic dependency graph through `spec→implement→qa→commit` using the native Workflow engine (no `claude -p`), with an enforced budget, a live `/workflows` tree, auto-delegation to `/athena:batch` when Workflow is unavailable, and `epic-progress.md` resume.

**Architecture:** Two planes. The **outer plane** is `flow.md` prose that the main-loop Claude obeys: resolve effort → probe for the Workflow tool → plan pending waves → loop waves (launch one Workflow per wave, write back after each) → never merge. The **inner plane** is a per-wave Workflow JS (authored by the main-loop with pure-literal wave/cap/model data) that `pipeline()`s each epic through the four stages and returns `AgentReport[]`.

**Tech Stack:** Markdown slash command (`.claude/commands/athena/`), Bash fixture test (grep-assertion style, mirrors `scripts/batch-tests/test-e201-schemas.sh`), existing helpers `scripts/epic-graph.sh --json --pending-only`, `scripts/effort/resolve.sh`, `scripts/hooks/audit-emit-pipeline.sh`. The Workflow JS targets the native Workflow tool (`agent({schema})`, `pipeline()`, `budget`, `log()`, `phase()`).

**Spec:** `docs/superpowers/specs/2026-06-04-athena-flow-design.md`

---

## File Structure

- **Create** `.claude/commands/athena/flow.md` — the command. Sections: frontmatter (grants `Workflow`), When-to-use, Step 0 effort, Step 1 probe+delegate, Step 2 wave planning, Step 3 wave loop, Step 4 write-back, Agent Report Schema, Step 5 Workflow script template.
- **Create** `scripts/flow-tests/test-flow-command.sh` — static fixture test asserting `flow.md` contains every required structure. Built up additively, one assertion-block per task.
- **No other files change.** `epic-graph.sh`, `resolve.sh`, `audit-emit-pipeline.sh`, the AgentReport schema, and `batch.md` are reused as-is.

Each task adds one `flow.md` section + its matching test assertions, keeping changes self-contained.

---

## Task 1: Scaffold `flow.md` frontmatter + test harness

**Files:**
- Create: `scripts/flow-tests/test-flow-command.sh`
- Create: `.claude/commands/athena/flow.md`

- [ ] **Step 1: Write the failing test (harness + frontmatter assertions)**

Create `scripts/flow-tests/test-flow-command.sh`:

```bash
#!/usr/bin/env bash
# scripts/flow-tests/test-flow-command.sh — /athena:flow command structure test
#
# Validates .claude/commands/athena/flow.md contains every required structure:
# Workflow tool grant, capability-probe + delegation, wave planning, the
# per-wave Workflow template (native agent({schema}), NO claude -p), write-back.
#
# Usage: bash scripts/flow-tests/test-flow-command.sh
# Exit: 0 = all pass, 1 = any failure. Runtime <2s.

set -uo pipefail

FLOW_MD=".claude/commands/athena/flow.md"
PASS=0
FAIL=0
RESULTS=()

pass() { PASS=$(( PASS + 1 )); RESULTS+=("  PASS: $1"); }
fail() {
  FAIL=$(( FAIL + 1 ))
  if [ -n "${2:-}" ]; then RESULTS+=("  FAIL: $1 — $2"); else RESULTS+=("  FAIL: $1"); fi
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FLOW_MD_PATH="$REPO_ROOT/$FLOW_MD"

if [ ! -f "$FLOW_MD_PATH" ]; then
  echo "ERROR: $FLOW_MD_PATH not found"
  exit 1
fi

# --- Task 1: frontmatter grants Workflow ---
if grep -qE '^allowed-tools:.*\bWorkflow\b' "$FLOW_MD_PATH"; then
  pass "frontmatter allowed-tools grants Workflow"
else
  fail "frontmatter allowed-tools grants Workflow" "no 'Workflow' in allowed-tools line"
fi

if grep -qE '^allowed-tools:.*\bAgent\b' "$FLOW_MD_PATH"; then
  pass "frontmatter allowed-tools grants Agent (delegation path)"
else
  fail "frontmatter allowed-tools grants Agent (delegation path)" "no 'Agent' in allowed-tools line"
fi

# --- summary ---
printf '%s\n' "${RESULTS[@]}"
echo "----"
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
```

- [ ] **Step 2: Run test to verify it fails (no flow.md yet)**

Run: `bash scripts/flow-tests/test-flow-command.sh`
Expected: `ERROR: .../flow.md not found` and exit 1.

- [ ] **Step 3: Create `flow.md` with frontmatter + title**

Create `.claude/commands/athena/flow.md`:

```markdown
---
description: "(epic) Interactive native-Workflow epic dispatcher → all ready waves until budget → spec→implement→qa→commit (no claude -p); auto-delegates to /athena:batch when Workflow unavailable."
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, Workflow
---

# Flow — Interactive Native-Workflow Epic Dispatcher

You run epics through the full dev pipeline using the **native Workflow engine**
(in-session subagents — **never `claude -p`**). You are **interactive-only**: when the
`Workflow` tool is unavailable, you delegate to `/athena:batch`.

## When to use vs /athena:batch
- `/athena:flow` — interactive sessions: live `/workflows` tree, enforced token budget,
  deterministic control flow, zero subprocess.
- `/athena:batch` — headless/cron/plugin; portable (`/loop 5m /athena:batch auto`).
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bash scripts/flow-tests/test-flow-command.sh`
Expected: `PASS=2 FAIL=0`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/flow-tests/test-flow-command.sh .claude/commands/athena/flow.md
git commit -m "feat(flow): scaffold /athena:flow command + structure test (Task 1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Capability probe + auto-delegation to `/athena:batch`

**Files:**
- Modify: `scripts/flow-tests/test-flow-command.sh` (add assertions before the summary block)
- Modify: `.claude/commands/athena/flow.md` (append sections)

- [ ] **Step 1: Add failing assertions**

In `scripts/flow-tests/test-flow-command.sh`, insert **before** the `# --- summary ---` line:

```bash
# --- Task 2: capability probe + delegation ---
if grep -q 'flow_delegated_to_batch' "$FLOW_MD_PATH"; then
  pass "delegation emits flow_delegated_to_batch audit event"
else
  fail "delegation emits flow_delegated_to_batch audit event" "missing 'flow_delegated_to_batch'"
fi

if grep -q 'audit-emit-pipeline.sh' "$FLOW_MD_PATH"; then
  pass "uses audit-emit-pipeline.sh helper"
else
  fail "uses audit-emit-pipeline.sh helper" "missing 'audit-emit-pipeline.sh'"
fi

if grep -qi '/athena:batch' "$FLOW_MD_PATH"; then
  pass "delegation target /athena:batch named"
else
  fail "delegation target /athena:batch named" "missing '/athena:batch'"
fi
```

- [ ] **Step 2: Run test to verify the 3 new assertions fail**

Run: `bash scripts/flow-tests/test-flow-command.sh`
Expected: `PASS=2 FAIL=3`, exit 1 (the 3 Task-2 lines FAIL).

- [ ] **Step 3: Append the Step 0 + Step 1 sections to `flow.md`**

Append to `.claude/commands/athena/flow.md`:

```markdown
## Step 0 — Resolve effort
Run and capture the effort knobs:
\`\`\`bash
source <(bash scripts/effort/resolve.sh "${ATHENA_EFFORT:-standard}")
# exports: MAX_CONCURRENT, MAX_ITERATIONS, REVIEW_LOOP_BUDGET, ATHENA_MODEL_MAP, ...
\`\`\`

## Step 1 — Capability probe + delegation
Confirm the `Workflow` tool is actually available in THIS session (it is a main-loop
tool; absent in headless/cron and in older Claude Code). If it is **not** callable:
1. `bash scripts/hooks/audit-emit-pipeline.sh flow_delegated_to_batch reason=workflow_unavailable || true`
2. Tell the user: "native Workflow unavailable here — delegating to /athena:batch (portable path)."
3. Invoke `/athena:batch auto` with the same arguments, then **STOP** (do not continue to Step 2).
```

- [ ] **Step 4: Run test to verify all pass**

Run: `bash scripts/flow-tests/test-flow-command.sh`
Expected: `PASS=5 FAIL=0`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/flow-tests/test-flow-command.sh .claude/commands/athena/flow.md
git commit -m "feat(flow): effort resolution + capability probe + batch delegation (Task 2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Wave planning + resume (pending-only graph, ✅-skip)

**Files:**
- Modify: `scripts/flow-tests/test-flow-command.sh`
- Modify: `.claude/commands/athena/flow.md`

- [ ] **Step 1: Add failing assertions**

Insert before `# --- summary ---`:

```bash
# --- Task 3: wave planning + resume ---
if grep -q 'epic-graph.sh --json --pending-only' "$FLOW_MD_PATH"; then
  pass "plans waves via epic-graph.sh --json --pending-only"
else
  fail "plans waves via epic-graph.sh --json --pending-only" "missing pending-only graph call"
fi

if grep -q 'epic-progress.md' "$FLOW_MD_PATH"; then
  pass "reads epic-progress.md for resume/skip"
else
  fail "reads epic-progress.md for resume/skip" "missing 'epic-progress.md'"
fi
```

- [ ] **Step 2: Run test to verify the 2 new assertions fail**

Run: `bash scripts/flow-tests/test-flow-command.sh`
Expected: `PASS=5 FAIL=2`, exit 1.

- [ ] **Step 3: Append the Step 2 section to `flow.md`**

Append to `.claude/commands/athena/flow.md`:

```markdown
## Step 2 — Plan pending waves
1. `bash scripts/epic-graph.sh --json --pending-only` → parse `.waves[]` (each `{wave, epics[]}`),
   already filtered to not-yet-completed epics.
2. Read `docs/context/epic-progress.md`; drop any epic already marked ✅ by a prior `/athena:flow`
   run in this cycle (this is the resume mechanism — re-running continues where it stopped).
3. If no pending epics remain → print "flow: nothing to do (graph drained)" and STOP.
```

- [ ] **Step 4: Run test to verify all pass**

Run: `bash scripts/flow-tests/test-flow-command.sh`
Expected: `PASS=7 FAIL=0`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/flow-tests/test-flow-command.sh .claude/commands/athena/flow.md
git commit -m "feat(flow): pending-only wave planning + epic-progress.md resume (Task 3)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Per-wave Workflow script template (the inner engine)

**Files:**
- Modify: `scripts/flow-tests/test-flow-command.sh`
- Modify: `.claude/commands/athena/flow.md`

- [ ] **Step 1: Add failing assertions**

Insert before `# --- summary ---`:

```bash
# --- Task 4: per-wave Workflow template ---
for field in '"status"' '"filesChanged"' '"worktreePath"' '"worktreeBranch"' '"summary"'; do
  if grep -q "$field" "$FLOW_MD_PATH"; then
    pass "AgentReport schema has $field"
  else
    fail "AgentReport schema has $field" "missing $field"
  fi
done

if grep -q 'pipeline(' "$FLOW_MD_PATH"; then
  pass "wave uses pipeline() per-epic dispatch"
else
  fail "wave uses pipeline() per-epic dispatch" "missing 'pipeline('"
fi

if grep -q "isolation:" "$FLOW_MD_PATH" && grep -q 'worktree' "$FLOW_MD_PATH"; then
  pass "implement stage is worktree-isolated"
else
  fail "implement stage is worktree-isolated" "missing isolation:'worktree'"
fi

if grep -q 'budget.remaining' "$FLOW_MD_PATH"; then
  pass "wave guards on budget.remaining()"
else
  fail "wave guards on budget.remaining()" "missing budget.remaining()"
fi

# Hard guarantee: flow must NEVER use claude -p (the whole point vs batch).
if grep -q 'claude -p' "$FLOW_MD_PATH"; then
  fail "no claude -p subprocess" "flow.md contains 'claude -p'"
else
  pass "no claude -p subprocess"
fi
```

- [ ] **Step 2: Run test to verify the new assertions fail**

Run: `bash scripts/flow-tests/test-flow-command.sh`
Expected: `PASS=7 FAIL=9` (5 schema fields + pipeline + isolation + budget + the claude-p check which currently PASSES since absent → actually counts as pass). Re-read output: the `no claude -p` assertion PASSES already (absent), so expect `FAIL=8`, exit 1.

- [ ] **Step 3: Append the Agent Report Schema + Step 5 template to `flow.md`**

Append to `.claude/commands/athena/flow.md`:

````markdown
## Agent Report Schema
Every stage result MUST match this schema (freeform → retry). No path advances from
`implement → commit` without a schema-valid `qa: status == "success"`.

```json
{
  "status": "success" | "failure" | "blocked",
  "filesChanged": ["<path>", "..."],
  "worktreePath": "<absolute path>",
  "worktreeBranch": "feat/E{n}-{slug}",
  "summary": "<one-line description>"
}
```

## Step 5 — Per-wave Workflow script template
For EACH pending wave, author this script with `WAVE`, `CAP`, and `MODEL` injected as
**pure literals** (you computed them in Steps 0 + 2 — never read files from inside the script),
then run it with the `Workflow` tool. One wave = one Workflow.

```javascript
export const meta = {
  name: 'athena-flow-wave',
  description: 'Dispatch one epic wave through spec->implement->qa->commit (native, no claude -p)',
  phases: [{ title: 'Wave', detail: 'per-epic spec/implement/qa/commit pipeline' }],
}

const WAVE  = ["E2XX", "E2YY"];                      // <-- literal: this wave's pending epics
const CAP   = 4;                                     // <-- literal: $MAX_CONCURRENT
const MODEL = { reviewer: "sonnet", evaluator: "sonnet" }; // <-- literal: $ATHENA_MODEL_MAP

const REPORT = {
  type: "object",
  required: ["status", "filesChanged", "worktreePath", "worktreeBranch", "summary"],
  properties: {
    status:         { enum: ["success", "failure", "blocked"] },
    filesChanged:   { type: "array", items: { type: "string" } },
    worktreePath:   { type: "string" },
    worktreeBranch: { type: "string" },
    summary:        { type: "string" },
  },
}

function runEpic(E) {
  // Budget guard (mechanism a): if a turn budget is set and exhausted, skip cleanly.
  if (budget.total && budget.remaining() <= 0) {
    log(`${E} skipped: budget exhausted`);
    return { status: "blocked", filesChanged: [], worktreePath: "", worktreeBranch: "", summary: "budget" };
  }
  const spec = agent(`Epic ${E}: read CLAUDE.md + docs/epics/${E.toLowerCase()}-*.md, then run the SPEC step (OpenAPI-first). Return ONLY the AgentReport JSON.`,
    { schema: REPORT, label: `${E}:spec`, phase: 'Wave' });
  if (spec.status !== "success") { log(`${E} drop @spec (${spec.status})`); return spec; }

  const impl = agent(`Epic ${E}: TDD-implement the spec in an isolated worktree. Return ONLY the AgentReport JSON.`,
    { schema: REPORT, label: `${E}:implement`, phase: 'Wave', isolation: "worktree" });
  if (impl.status !== "success") { log(`${E} drop @implement (${impl.status})`); return impl; }

  const qa = agent(`Epic ${E}: QA the changes at ${impl.worktreePath} (reviewer=${MODEL.reviewer}, evaluator=${MODEL.evaluator}); 80% coverage gate. Return ONLY the AgentReport JSON.`,
    { schema: REPORT, label: `${E}:qa`, phase: 'Wave', model: MODEL.evaluator });
  if (qa.status !== "success") { log(`${E} drop @qa (${qa.status})`); return qa; }

  return agent(`Epic ${E}: commit the changes on ${impl.worktreeBranch} (Conventional Commits). Do NOT merge. Return ONLY the AgentReport JSON.`,
    { schema: REPORT, label: `${E}:commit`, phase: 'Wave' });
}

phase('Wave');
// pipeline() = per-epic streaming, NO barrier: fast epics reach commit while siblings implement.
const results = pipeline(WAVE.slice(0, CAP), runEpic);
return results;
```
````

- [ ] **Step 4: Run test to verify all pass**

Run: `bash scripts/flow-tests/test-flow-command.sh`
Expected: `PASS=16 FAIL=0`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/flow-tests/test-flow-command.sh .claude/commands/athena/flow.md
git commit -m "feat(flow): per-wave native Workflow template (pipeline, schema, worktree, budget) (Task 4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Outer wave loop + write-back + merge-stays-outside

**Files:**
- Modify: `scripts/flow-tests/test-flow-command.sh`
- Modify: `.claude/commands/athena/flow.md`

- [ ] **Step 1: Add failing assertions**

Insert before `# --- summary ---`:

```bash
# --- Task 5: wave loop + write-back + no-merge ---
if grep -q 'orchestration-log.md' "$FLOW_MD_PATH"; then
  pass "write-back appends orchestration-log.md"
else
  fail "write-back appends orchestration-log.md" "missing 'orchestration-log.md'"
fi

# Merge must be explicitly excluded from the workflow span.
if grep -qiE 'do not merge|merge stays|never merge|merge.*outer' "$FLOW_MD_PATH"; then
  pass "merge explicitly excluded from flow"
else
  fail "merge explicitly excluded from flow" "no statement that merge stays outside flow"
fi

if grep -qE 'MAX_ITERATIONS|count.?cap|count cap' "$FLOW_MD_PATH"; then
  pass "outer loop has a count-cap budget backstop"
else
  fail "outer loop has a count-cap budget backstop" "missing count-cap / MAX_ITERATIONS backstop"
fi
```

- [ ] **Step 2: Run test to verify the 3 new assertions fail**

Run: `bash scripts/flow-tests/test-flow-command.sh`
Expected: `PASS=16 FAIL=3`, exit 1.

- [ ] **Step 3: Append the Step 3 (wave loop) + Step 4 (write-back) sections to `flow.md`**

Append to `.claude/commands/athena/flow.md`:

```markdown
## Step 3 — Wave loop (outer plane — you own this, NOT the Workflow)
Set a count-cap backstop = `MAX_ITERATIONS * MAX_CONCURRENT` epics (the practical stand-in
for the token budget, since the main-loop cannot read `budget.spent()` outside a script).
For each pending wave in order, while the count-cap is not exceeded:
1. Author the Step-5 Workflow script with this wave's epics, `CAP`, `MODEL` as pure literals.
2. Run it via the `Workflow` tool; await the returned `AgentReport[]`.
3. Write back (Step 4).
4. If the count-cap is reached, STOP before the next wave (clean checkpoint).
After the loop: print a summary table. **Do NOT merge any epic** — merge stays manual /
outer-plane (it can carry a policy/human gate), exactly as `/autopilot` keeps merge gated.

## Step 4 — Write-back (you do this; the Workflow cannot touch the filesystem)
For each epic in the returned `AgentReport[]`:
- `status == "success"` → mark the epic ✅ in `docs/context/epic-progress.md`; then
  `bash scripts/hooks/audit-emit-pipeline.sh commit epic=<E> branch=<worktreeBranch> || true`
- `status == "failure"|"blocked"` → mark the epic ❌ in `docs/context/epic-progress.md`; then
  `bash scripts/hooks/audit-emit-pipeline.sh qa_result epic=<E> verdict=fail || true`
Append a one-line wave summary to `docs/context/orchestration-log.md`.
Update BOTH `epic-progress.md` (run tracking) and look up `EPIC_INDEX.md` for epic details, per
batch convention — but DONE-marking in `EPIC_INDEX.md` is deferred to merge time (flow stops at commit).
```

- [ ] **Step 4: Run test to verify all pass**

Run: `bash scripts/flow-tests/test-flow-command.sh`
Expected: `PASS=19 FAIL=0`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/flow-tests/test-flow-command.sh .claude/commands/athena/flow.md
git commit -m "feat(flow): outer wave loop + write-back + merge-excluded backstop (Task 5)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Register test, full-suite + drift check, finalize

**Files:**
- Modify: test aggregator / CI (discovered in Step 1)
- Verify: `make drift-check`, `scripts/sync-to-plugin.sh`

- [ ] **Step 1: Find where sibling fixture tests are registered**

Run: `grep -rn "test-e201-schemas" --include='*.sh' --include='*.yml' --include='*.yaml' --include='Makefile' .`
Expected: one or more aggregator/CI references. Add `bash scripts/flow-tests/test-flow-command.sh` in the same place(s), immediately after the e201 line. If the grep returns nothing (no aggregator), skip — the standalone test is sufficient; note this in the commit body.

- [ ] **Step 2: Run the flow test standalone**

Run: `bash scripts/flow-tests/test-flow-command.sh`
Expected: `PASS=19 FAIL=0`, exit 0.

- [ ] **Step 3: Run the e201 test to confirm no regression to batch.md**

Run: `bash scripts/batch-tests/test-e201-schemas.sh`
Expected: exit 0 (batch.md untouched).

- [ ] **Step 4: Drift check against the athena-core plugin**

Run: `make drift-check`
Expected: it reports `flow.md` as new/divergent (since it isn't yet in `athena-core`). That is correct — the export happens via `scripts/sync-to-plugin.sh --apply` as a separate, user-driven step (do NOT run `--apply` here; the plugin sync is the user's call per CLAUDE.md E202).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(flow): register /athena:flow fixture test in suite (Task 6)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Span `spec→implement→qa→commit` → Task 4 `runEpic` (4 stages). ✅
- All-waves-until-budget → Task 5 wave loop + count-cap + Task 4 `budget.remaining()`. ✅
- Native engine, no `claude -p` → Task 4 template + the explicit `no claude -p` test assertion. ✅
- Auto-delegate when Workflow unavailable → Task 2 (`flow_delegated_to_batch`). ✅
- Durability (per-wave checkpoint + per-epic `log()`) → Task 5 write-back + Task 4 `log()` per stage. ✅
- Resume via `epic-progress.md` → Task 3. ✅
- Workflow grant in frontmatter → Task 1. ✅
- Merge stays outside → Task 5 (`Do NOT merge` + test assertion). ✅
- Budget wiring (a)+(b) → Task 4 (a, `budget.remaining()`) + Task 5 (b, count-cap). ✅
- Testing (static + probe-fallback + resume) → Tasks 1–5 assertions; `make drift-check` → Task 6. ✅

**Placeholder scan:** No TBD/TODO. `WAVE = ["E2XX","E2YY"]` is an intentional template literal the main-loop replaces at author-time (documented inline as `<-- literal`), not a plan placeholder. ✅

**Type consistency:** `REPORT` schema fields (`status/filesChanged/worktreePath/worktreeBranch/summary`) are identical across Task 4 template, the JSON schema block, and Task 1/4 test assertions. `runEpic` uses `impl.worktreePath` and `impl.worktreeBranch` — both defined in `REPORT`. Audit events `flow_delegated_to_batch` (Task 2), `commit`/`qa_result` (Task 5) match `audit-emit-pipeline.sh`'s documented event names. ✅

**Test-count note:** the running `PASS=N` totals assume assertions are appended in the documented order; if the implementer reorders, only the totals shift — the per-assertion expectations stand.
