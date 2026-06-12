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

## Step 0 — Resolve effort
Run and capture the effort knobs:
```bash
source <(bash scripts/effort/resolve.sh "${ATHENA_EFFORT:-standard}")
# exports: MAX_CONCURRENT, MAX_ITERATIONS, REVIEW_LOOP_BUDGET, ATHENA_MODEL_MAP, ...
```

## Step 1 — Capability probe + delegation
Confirm the `Workflow` tool is actually available in THIS session (it is a main-loop
tool; absent in headless/cron and in older Claude Code). If it is **not** callable:
1. `bash scripts/hooks/audit-emit-pipeline.sh flow_delegated_to_batch reason=workflow_unavailable || true`
2. Tell the user: "native Workflow unavailable here — delegating to /athena:batch (portable path)."
3. Invoke `/athena:batch auto` with the same arguments, then **STOP** (do not continue to Step 2).

## Step 2 — Plan pending waves
1. `bash scripts/epic-graph.sh --json --pending-only` → parse `.waves[]` (each `{wave, epics[]}`),
   already filtered to not-yet-completed epics.
2. Read `docs/context/epic-progress.md`; drop any epic already marked ✅ by a prior `/athena:flow`
   run in this cycle (this is the resume mechanism — re-running continues where it stopped).
3. If no pending epics remain → print "flow: nothing to do (graph drained)" and STOP.

## Step 3 — Wave loop (outer plane — you own this, NOT the Workflow)
Set a count-cap backstop = `MAX_ITERATIONS * MAX_CONCURRENT` epics (the practical stand-in
for the token budget, since the main-loop cannot read `budget.spent()` outside a script).
For each pending wave in order, while the count-cap is not exceeded:
1. Author the Step-5 Workflow script (below) with this wave's epics, `CAP`, `MODEL` as pure literals.
2. Run it via the `Workflow` tool; await the returned `AgentReport[]`.
3. Write back (Step 4).
4. If the count-cap is reached, STOP before the next wave (clean checkpoint).
After the loop: print a summary table. **Do NOT merge any epic** — merge stays manual /
outer-plane (it can carry a policy/human gate), exactly as `/autopilot` keeps merge gated.

## Step 4 — Write-back (you do this; the Workflow cannot touch the filesystem)
For each epic in the returned `AgentReport[]`:
- `status == "success"` → mark the epic ✅ in `docs/context/epic-progress.md`; then
  `bash scripts/hooks/audit-emit-pipeline.sh commit epic=<E> branch=<worktreeBranch> || true`
- `status == "failure"` → mark the epic ❌ in `docs/context/epic-progress.md` (genuine QA/impl failure); then
  `bash scripts/hooks/audit-emit-pipeline.sh qa_result epic=<E> verdict=fail || true`
- `status == "blocked"` → leave the epic **PENDING** (neither ✅ nor ❌ — a block is *not* a QA failure); then
  `bash scripts/hooks/audit-emit-pipeline.sh flow_blocked epic=<E> || true`. The next `/athena:flow` run retries it (resume skips only ✅).
Append a one-line wave summary to `docs/context/orchestration-log.md`.
Update BOTH `epic-progress.md` (run tracking) and look up `EPIC_INDEX.md` for epic details, per
batch convention — but DONE-marking in `EPIC_INDEX.md` is deferred to merge time (flow stops at commit).

## Agent Report Schema
Every stage result MUST match this schema (freeform → retry). No path advances from
`implement → commit` without a schema-valid `qa: status == "success"`.

```json
{
  "status": "success" | "failure" | "blocked",
  "filesChanged": ["<path>", "..."],
  "worktreePath": "<absolute path>",
  "worktreeBranch": "MH/feat/E{n}-{slug}",
  "summary": "<one-line description>"
}
```

## Step 5 — Per-wave Workflow script template
For EACH pending wave, author this script with `WAVE`, `CAP`, and `MODEL` injected as
**pure literals** (computed in Steps 0 + 2 — never read files from inside the script),
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

// ONE worktree-isolated agent runs the WHOLE per-epic pipeline. The engine's
// isolation:'worktree' is PER-AGENT — so spec/implement/qa/commit MUST live in a
// single agent to share one working tree. Splitting them into separate agents would
// strand qa/commit in the main repo, unable to see implement's worktree changes
// (and a Workflow script may not `cd`/touch the fs itself). The qa-gate is enforced
// IN-PROMPT: status="success" REQUIRES qa-passed AND committed.
function runEpic(E) {
  return agent(
    [
      `Epic ${E}. Work end-to-end in THIS isolated worktree; do all four steps IN ORDER:`,
      `1. SPEC — read CLAUDE.md + docs/epics/${E.toLowerCase()}-*.md; edit docs/openapi.yaml FIRST (OpenAPI-first SSOT).`,
      `2. IMPLEMENT — TDD red→green→refactor against the spec.`,
      `3. QA — run both test suites; enforce the 80% coverage gate (reviewer=${MODEL.reviewer}, evaluator=${MODEL.evaluator}). If QA fails, return status="failure" and DO NOT commit.`,
      `4. COMMIT — only if QA passed: commit on branch MH/feat/${E}-<slug> (Conventional Commits). Do NOT merge.`,
      `Return ONLY the AgentReport JSON: status="success" requires implemented AND qa-passed AND committed; "failure" if impl/QA failed; "blocked" if you cannot proceed (e.g. unmet dependency / needs human).`,
    ].join("\n"),
    { schema: REPORT, label: `${E}`, phase: "Wave", isolation: "worktree" }
  );
}

phase('Wave');
// Run ALL wave epics (independent), CAP at a time to honor the effort tier's MAX_CONCURRENT.
// pipeline() streams within each batch (fast epics reach commit while siblings implement);
// batches run in sequence. NO epic is ever dropped — a first-CAP-only truncation would
// silently lose the tail. Budget (mechanism a) short-circuits BETWEEN batches; un-run epics stay pending
// and resume on the next /athena:flow invocation (no false ❌).
const results = [];
for (let i = 0; i < WAVE.length; i += CAP) {
  if (budget.total && budget.remaining() <= 0) {
    log(`budget exhausted — ran ${results.length}/${WAVE.length} epics this wave; rest stay pending`);
    break;
  }
  results.push(...pipeline(WAVE.slice(i, i + CAP), runEpic));
}
return results;
```
