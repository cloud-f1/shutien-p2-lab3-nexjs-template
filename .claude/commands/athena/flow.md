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
Run and capture the effort knobs. Honor a `--effort <tier>` flag passed in `$ARGUMENTS` — same
precedence as every other athena command (`--effort` flag > `$ATHENA_EFFORT` env > default
`standard`), which `resolve.sh` handles when it parses `$ARGUMENTS`:
```bash
eval "$(bash scripts/effort/resolve.sh "$ARGUMENTS" 2>/dev/null || true)"
# exports: MAX_CONCURRENT, MAX_ITERATIONS, REVIEW_LOOP_BUDGET, ATHENA_MODEL_MAP, ...
```
`ATHENA_MODEL_MAP` now carries three models: `reviewer`, `evaluator`, and **`execute`**
(the per-epic spec→implement→qa→commit agent's baseline). Parse all three into the
`MODEL` literal for Step 5. `execute` is the model for a *simple* epic; Step 2 marks
*complex* epics so Step 5 escalates them to `opus`. This is what keeps the dispatch
from running every epic on opus — model now tracks task complexity, mirroring the
athena agent team's doer(sonnet)/thinker(opus) split.

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
4. **Classify each pending epic's complexity** (drives its model). Size lives in each epic
   file's `size:` header (S/M/L), not in the matrix (which has no Size column) — resolve it
   in this source order: **(a)** the `size:` line in the epic file header
   `docs/epics/e{n}-*.md` (produced by `scripts/plan/brainstorm-emit.sh render-epic`);
   **(b)** a `Size: S/M/L` text elsewhere in the epic file body; **(c)** the Notes column of
   the epic's row in `docs/context/epic-progress.md`; **(d)** unknown → `"simple"`.
   `S`/`M` (or `< 8` SP) → `"simple"`; `L`/`XL` (or `≥ 8` SP), or anything touching
   auth/security/migrations/multi-file features → `"complex"`.
   Build the `COMPLEXITY` literal `{ Exxx: "simple"|"complex", ... }` for Step 5.

## Step 3 — Wave loop (outer plane — you own this, NOT the Workflow)
Set a count-cap backstop = `MAX_ITERATIONS * MAX_CONCURRENT` epics (the practical stand-in
for the token budget, since the main-loop cannot read `budget.spent()` outside a script).
For each pending wave in order, while the count-cap is not exceeded:
1. Author the Step-5 Workflow script (below) with this wave's epics, `CAP`, `MODEL` (incl. `execute`), and `COMPLEXITY` as pure literals.
2. Run it via the `Workflow` tool; await the returned `AgentReport[]`.
3. Write back (Step 4).
4. If the count-cap is reached, STOP before the next wave (clean checkpoint).
After the loop: print a summary table. **Do NOT merge any epic** — merge stays manual /
outer-plane (it can carry a policy/human gate), exactly as `/autopilot` keeps merge gated.

## Step 4 — Write-back (you do this; the Workflow cannot touch the filesystem)
**Cell granularity (flow stops at commit — never at merge):** on `success`, mark the **spec, implement, qa, and commit** cells ✅ and **LEAVE the merge cell ⬜** (or `⏸ awaiting human merge (PR #N)` if this run pushed a branch + opened a PR). A later `/athena:loop` (Step 1a) reconciles the merge cell once the human merges. flow NEVER runs `gh pr merge` — merge is human/outer-plane.

For each epic in the returned `AgentReport[]`, use `scripts/state/state-update.sh` as the primary
write-back mechanism (it updates `docs/context/epic-progress.md` and syncs `docs/epics/EPIC_INDEX.md`
via `render-index.sh` in one call per cell; fall back to manually editing both files only if the
script errors):
- `status == "success"` → mark spec/implement/qa/commit ✅ (merge stays ⬜ or ⏸) — one call per cell:
  `for STEP in spec implement qa commit; do bash scripts/state/state-update.sh <E> $STEP done; done`; then
  `bash scripts/hooks/audit-emit-pipeline.sh commit epic=<E> branch=<worktreeBranch> || true`
- `status == "failure"` → `bash scripts/state/state-update.sh <E> <step-that-failed> failed --note "<reason>"` (genuine QA/impl failure — `<step-that-failed>` is `implement` or `qa`, whichever the agent reported); then
  `bash scripts/hooks/audit-emit-pipeline.sh qa_result epic=<E> verdict=fail || true`
- `status == "blocked"` → leave the epic **PENDING** (neither ✅ nor ❌ — a block is *not* a QA failure; no state-update.sh call needed, pending is the existing default); then
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
  "worktreeBranch": "feat/E{n}-{slug}",
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
const MODEL = { execute: "sonnet", reviewer: "sonnet", evaluator: "sonnet" }; // <-- literal: $ATHENA_MODEL_MAP

// Per-epic model is chosen by TASK COMPLEXITY — NOT blanket opus. This mirrors the
// athena agent team's tiering (doers like @reviewer/@qa/@debugger = sonnet; only
// deep-design/orchestration like @spec-writer/@best-practice/@strategist = opus).
// COMPLEXITY is injected from Step 2 by reading each epic's size, in source order:
//   (a) `size:` header in docs/epics/e{n}-*.md, (b) `Size: S/M/L` text in the epic file
//   body, (c) the Notes column of the epic's row in epic-progress.md, (d) unknown -> simple.
//   S / M  → "simple"  → MODEL.execute (sonnet at standard)
//   L / XL → "complex" → "opus"
// At ultra tier MODEL.execute is already "opus", so everything escalates there.
const COMPLEXITY = { E2XX: "complex", E2YY: "simple" }; // <-- literal: per-epic, from Step 2 size classification
const modelForEpic = (E) => (COMPLEXITY[E] === "complex" ? "opus" : MODEL.execute);

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
//
// ⚠️ WORKTREE READINESS (the /athena:flow gotcha): a fresh git worktree has NO
// `next-app/node_modules` (gitignored, not copied), so `pnpm typecheck|lint|test|
// build` and `npx shadcn add` all fail until deps are installed. Two rules:
//   1. node_modules-dependent QA → the agent runs `cd next-app && pnpm install
//      --prefer-offline` first (shared pnpm store → fast).
//   2. Epics that run `npx shadcn add` (writes components/ui/) or edit `.claude/`
//      are NOT worktree-safe (shadcn-add needs network+config; .claude/** writes
//      need a permission absent in worktrees). Such epics return status="blocked"
//      with reason "needs in-repo run" → the orchestrator runs them in the main
//      repo (NOT via a worktree agent). Pre-screen these out of flow waves.
function runEpic(E) {
  return agent(
    [
      `Epic ${E}. Work end-to-end in THIS isolated worktree; do all steps IN ORDER:`,
      `0. WORKTREE READINESS — this worktree has NO next-app/node_modules. If your QA needs them, run \`cd next-app && pnpm install --prefer-offline\` first. If this epic requires \`npx shadcn add\` (writes components/ui/) or edits \`.claude/\`, it is NOT worktree-safe → return status="blocked", reason "needs in-repo run", and STOP (the orchestrator will run it in the main repo).`,
      `1. SPEC — read CLAUDE.md + docs/epics/${E.toLowerCase()}-*.md; reconcile scope. (This is a single Next.js app — no OpenAPI/server SSOT.)`,
      `2. IMPLEMENT — follow the spec: Server Components by default, @/ alias, shadcn from components/ui/, Drizzle for DB, "use server" for mutations, cn() for classes.`,
      `3. QA — from next-app/: \`pnpm typecheck && pnpm lint && pnpm test\` (+ \`pnpm build\` for anything touching build/runtime). If QA fails, return status="failure" and DO NOT commit.`,
      `4. COMMIT — only if QA passed: commit on branch feat/${E}-<slug> (Conventional Commits). Do NOT merge.`,
      `Return ONLY the AgentReport JSON: status="success" requires implemented AND qa-passed AND committed; "failure" if impl/QA failed; "blocked" if you cannot proceed (unmet dependency / needs in-repo run / needs human).`,
    ].join("\n"),
    { schema: REPORT, label: `${E}`, phase: "Wave", isolation: "worktree", model: modelForEpic(E) }
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
  results.push(...(await pipeline(WAVE.slice(i, i + CAP), runEpic)));
}
return results;
```

## Step 6 — Sequential In-Repo Chain Mode (coupled / migration-heavy phases)

The parallel-worktree pattern above (Steps 3–5) is right for **independent** epics. It
BREAKS for a **coupled phase** — prefer a single sequential chain on ONE branch instead.
This is distinct from `/athena:batch`'s Step 3.5 fallback (`--max-concurrent 1`), which
triggers on *infra failure* (broken worktree isolation); this mode is a **deliberate
choice** made up front because the epics are coupled by design, not because parallel
dispatch broke.

**Use the sequential chain when ANY holds:**
- **Dependency chain** — a later epic needs an earlier epic's *committed code at QA time*
  (e.g. schema → enum → UI: the UI epic can't typecheck without the new column + enum).
- **≥2 epics add DB migrations** — each worktree branches from the same `main` HEAD and
  `db:generate` picks the *same next number* → N migrations collide at merge. Sequential
  stacks them cleanly (0008 → 0009 → …).
- **A foundational epic is worktree-unsafe** (`npx shadcn add`, new npm deps, `.claude/`
  edits) AND other epics import its output — they can't build until it lands.

**Pattern:** one Workflow, **NO `isolation:'worktree'`** (agents share the main repo on a
pre-created `feat/phase-<N>-<slug>` branch), dependency-ordered, **stop-on-failure**. Each
agent commits before the next starts → migrations stack, downstream sees upstream, zero
cross-branch conflict. Survives interrupts (a killed/limited agent returns non-`success` →
chain stops clean; relaunch resumes — completed epics are already committed).

```javascript
// Outer-plane pre-step (before the Workflow): git checkout -b feat/phase-NN-slug
const CHAIN = [/* {id, slug, type, migration, notes} in dependency order */];
const MODEL      = { execute: "sonnet", reviewer: "sonnet", evaluator: "sonnet" }; // <-- literal: $ATHENA_MODEL_MAP (Step 0)
const COMPLEXITY = { /* Exxx: "simple"|"complex" */ };                             // <-- literal: per-epic, from Step 2 size classification
// Per-epic model tiers by complexity — SAME rule as the parallel path (Step 5):
// reuse COMPLEXITY (from Step 2) + MODEL.execute (from Step 0). Do NOT hardcode opus for
// every epic — a simple S/M epic runs on MODEL.execute (sonnet at standard); only a
// "complex" epic (L/XL, or auth/security/migrations/multi-file) escalates to opus.
const modelForEpic = (E) => (COMPLEXITY[E] === "complex" ? "opus" : MODEL.execute);
phase('Chain');
const results = [];
for (const e of CHAIN) {
  const r = await agent([
    `Epic ${e.id}. Work in the MAIN repo on the ALREADY-CHECKED-OUT branch feat/phase-NN-slug.`,
    `Do NOT create a worktree, switch, or merge. node_modules is installed.`,
    `1. SPEC — read CLAUDE.md + the enriched docs/epics/${e.id.toLowerCase()}-*.md.`,
    `2. IMPLEMENT — ${e.notes}`,
    `3. QA — from next-app/: pnpm typecheck && pnpm lint && pnpm test`
      + (e.migration ? ` && pnpm db:test-migrate` : ``)
      + ` && (DATABASE_URL=... AUTH_SECRET=dev pnpm build). On real failure → status="failure", do NOT commit.`,
    `4. COMMIT — only if QA passed: SCOPE the add to owned dirs — \`git add next-app docs\``,
    `   (NOT \`git add -A\`, which sweeps stray repo-root/OS files) then commit "${e.type}(${e.id}): ...".`,
  ].join("\n"), { schema: REPORT, label: e.id, phase: "Chain", model: modelForEpic(e.id) });
  results.push({ epic: e.id, report: r });
  if (!r || r.status !== "success") { log(`CHAIN STOPPED at ${e.id}`); break; }  // stop-on-failure
  log(`${e.id} ✓ committed`);
}
return results;
```

**Write-back is the same as Step 4.** After the chain: run the *integrated* gate on the
final branch (`pnpm typecheck && pnpm test && pnpm db:test-migrate && pnpm build`) —
per-epic QA does not prove the merged whole. Merge stays manual (outer plane).

> **Two gotchas this mode prevents/needs:**
> - **Scoped `git add`** (above) — never `git add -A` in a shared-repo agent; it sweeps
>   stray repo-root/OS files into the commit.
> - **Dev-DB drift** — after a phase with a new migration merges, `pnpm db:migrate` the
>   local dev DB to HEAD before running the app/e2e, or pages that read the new columns
>   will 500.
