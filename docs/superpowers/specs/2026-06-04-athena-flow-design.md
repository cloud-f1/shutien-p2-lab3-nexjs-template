# `/athena:flow` — Design Spec

> Status: **Approved design** (brainstorming complete 2026-06-04). Next: implementation plan via `writing-plans`.
> Author: Claude (ultracode session) · Branch: `feat/athena-flow`

---

## 1. Purpose

`/athena:flow` is an **interactive-only** sibling of `/athena:batch` that drains the epic
dependency graph through the full `spec → implement → qa → commit` pipeline using the
**native Workflow engine** (in-session subagents — **no `claude -p` subprocess**), with an
enforced token budget, a live `/workflows` progress tree, and cross-invocation resume via
`epic-progress.md`.

It exists because `/athena:batch`'s only structured-output dispatch path is the
`claude -p --output-format json --json-schema` **subprocess IPC** shipped by E200/E201, and
its `REVIEW_LOOP_BUDGET` knob is **informational only** (verified: `scripts/reviewer-loop.sh:16`,
emitted at line 126, never gates exit). `/athena:flow` provides genuinely native in-session
orchestration with an **enforced** budget and live instrumentation — capabilities `batch`
cannot offer interactively. The price is portability: **`flow` cannot run headless/cron**, so
`batch` remains the portable, plugin-shipped, cron-driven path.

### Relationship to `/athena:batch` (not redundant — complementary)

| | `/athena:batch` (exists) | `/athena:flow` (this spec) |
|---|---|---|
| Engine | Model-driven `Agent(...)`; or `claude -p --json-schema` IPC (`parallel` posture) | Native Workflow `agent({schema})`, deterministic JS |
| Runs where | Portable: interactive **and** headless/cron; ships in `athena-core` | **Interactive main-loop only** |
| `claude -p` subprocess | Yes (`parallel` posture) | **No** — in-session |
| Token budget | `REVIEW_LOOP_BUDGET` — logged, **not enforced** | Native `budget` — **hard ceiling** |
| Scope per run | One step / one wave | **All ready waves until budget exhausted** |
| Live view | `audit.jsonl` only | `/workflows` live tree |
| Failure handling | Parse JSON `status`, manual ❌ | `pipeline()` null-drop + schema returns |

One-liner: **`batch` is the portable workhorse you can cron; `flow` is its interactive-only
twin on the native Workflow engine — same pipeline, deterministic control flow, a *real* hard
budget dial, a live tree, and no subprocess.**

---

## 2. Locked decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Per-epic span | `spec → implement → qa → commit` (merge stays in the human-gated outer plane) |
| Invocation scope | All ready waves until budget exhausted **or** graph drained |
| Engine | Native Workflow `agent({schema})` — **no `claude -p`** |
| When Workflow unavailable | **Auto-delegate to `/athena:batch`** + explicit `flow_delegated_to_batch` audit event |
| Durability | Per-wave Workflow + per-epic `log()` + write-back after each wave |
| Resume | Re-run = resume (read `epic-progress.md`, skip ✅); `resumeFromRunId` as same-session speedup |

---

## 3. Architecture — two planes

The design splits cleanly into an **outer plane** (durable, resumable, owned by the main-loop
Claude executing `flow.md`) and an **inner plane** (fast parallel dispatch, owned by one
Workflow per wave). This mirrors the system-level recommendation: human/state-bearing control
stays model-driven; the gate-free parallel span becomes a real Workflow.

### Outer plane (main-loop, instructed by `flow.md`)
1. **Resolve effort:** `scripts/effort/resolve.sh` → `MAX_CONCURRENT`, `REVIEW_LOOP_BUDGET`,
   `ATHENA_MODEL_MAP` (`reviewer=…,evaluator=…`).
2. **Capability probe:** is the `Workflow` tool callable in this context? If **no** →
   delegate to `/athena:batch`, emit `flow_delegated_to_batch`, stop.
3. **Plan waves:** run `scripts/epic-graph.sh --json` → `{nodes,edges,waves}`; read
   `docs/context/epic-progress.md`; compute the pending waves (skip epics already ✅).
4. **Wave loop:**
   ```
   while (pending waves remain AND budget not exhausted) {
     launch ONE per-wave Workflow for the next pending wave
     on return: write epic-progress.md + orchestration-log.md + audit.jsonl
     re-check budget
   }
   ```
5. **After loop:** print summary. **Merge is NOT performed by flow** — it stays manual /
   outer-plane (it can carry a policy/human gate, cf. `/autopilot` merge-always-pauses).

### Inner plane (one Workflow per wave)
- `meta` carries pure-literal `WAVE` epics, `CAP` (= `MAX_CONCURRENT`), and model map —
  injected by the main-loop after running the shell helpers (no filesystem/RNG/clock in script).
- `pipeline(epics.slice(0, CAP), spec, implement, qa, commit)` — each epic streams
  independently through the four stages; `implement` is worktree-isolated; every stage
  `log({epic, stage, status})`; a `qa` failure → null-drop (epic excluded, siblings unaffected).
- Returns the wave's `AgentReport[]` to the main-loop.

---

## 4. Components / files

- **New:** `.claude/commands/athena/flow.md`
  - Frontmatter `allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, Workflow`
    — **adds `Workflow`**, the grant `batch.md` lacks (verified `batch.md:3`).
- **Reused verbatim:**
  - `scripts/epic-graph.sh --json` — wave plan (`print_json`, ~`epic-graph.sh:418–476`).
  - `scripts/effort/resolve.sh` — effort knobs.
  - **E201 AgentReport schema** `{status, filesChanged, worktreePath, worktreeBranch, summary}`
    (`batch.md:268–276, 347–355`) — dropped in 1:1 as the `agent({schema})` arg.
- **Written by main-loop** (Workflow scripts cannot touch the filesystem):
  `docs/context/epic-progress.md`, `docs/context/orchestration-log.md`, `.claude/audit.jsonl`.
- **Plugin sync:** `flow.md` exports via `scripts/sync-to-plugin.sh` to `athena-core` like any
  command; it is inert in forks lacking the Workflow tool — the delegation path (§5) covers them.

---

## 5. Error handling

| Condition | Behavior |
|---|---|
| `qa` fail / coverage < 80% | Epic null-dropped from the wave, marked ❌ in `epic-progress.md`; run continues |
| Budget exhausted | Finish in-flight wave → write-back → stop before next wave (clean checkpoint) |
| Workflow tool unavailable | Auto-delegate to `/athena:batch`; emit `flow_delegated_to_batch` |
| Run killed mid-wave | Re-run `/athena:flow`; ✅-skip resumes from the in-flight wave (completed epics already committed) |
| Worktree isolation broken | Inherit `batch`'s posture: the implement stage's worktree failure marks the epic ❌; **Step 3.5-style probe is retained**, native isolation NOT trusted to retire it on day one |

---

## 6. Open implementation detail — budget wiring

The Workflow `budget` global is **harness-set from the user's turn directive** (e.g. `+500k`)
and is **not script-settable**. Therefore athena's `REVIEW_LOOP_BUDGET` (from `resolve.sh`)
cannot be assigned into `budget.total` directly. Resolution (to finalize in the plan):

- **(a) primary:** inside each wave Workflow, guard with `budget.remaining()` *if a turn budget
  is set*; document that `--effort ultra` pairs with a `+500k`-style turn budget. Uses the real
  enforced ceiling.
- **(b) backstop:** the main-loop enforces a **wave/epic count cap** derived from the effort
  tier (the main-loop cannot read `budget.spent()` outside a script), as the practical stand-in.

Decision: **(a) + (b)** — `budget.remaining()` inside waves, count-cap backstop in the outer loop.

---

## 7. Testing

- **Static fixture test** (mirrors `scripts/effort/tests/test-e201-schemas.sh` style):
  assert `flow.md` frontmatter grants `Workflow`; references `epic-graph.sh --json`, the
  AgentReport schema fields, and the delegation path.
- **Probe-fallback test:** simulate "Workflow unavailable" → assert delegation to `/athena:batch`
  and a `flow_delegated_to_batch` audit event.
- **Resume test:** with some epics pre-marked ✅ in a fixture `epic-progress.md`, assert the
  wave planner skips them.
- `make drift-check` clean after `scripts/sync-to-plugin.sh --apply`.

---

## 8. Out of scope (YAGNI)

- Headless/cron `flow` (that is `batch`'s job — explicitly not portable).
- Folding `flow` into `batch` as a `--flow` flag (kept a clean standalone sibling).
- Any change to `batch`'s `standard`/`parallel` postures.
- Any change to the human-gated `/loop` · `/autopilot` · `/cycle` commands.
- Retiring the Step 3.5 isolation probe (native worktree isolation unvalidated — keep both).

---

## 9. Provenance

Derived from a 9-agent Workflow analysis (`athena-workflow-integration-v2`) whose adversarial
critic established the decisive facts, all repo-verified:
- `batch.md:3` `allowed-tools` omits `Workflow`; the native engine is used nowhere in athena.
- E200/E201 shipped structured dispatch over `claude -p --json-schema` (`verify-panel.sh:6,127`),
  **not** the native Workflow tool; `batch.md`'s "WORKFLOW-NATIVE" label is athena's own coinage.
- `REVIEW_LOOP_BUDGET` is informational, not enforced (`reviewer-loop.sh:16`).

---

## 10. Post-build validation amendment (2026-06-04)

An adversarial audit of the as-built `flow.md` against the real Workflow-engine API corrected three points; the **as-built design supersedes §3/§5 where they differ**:

- **Per-epic dispatch is ONE worktree-isolated agent**, not four pipelined stage-agents. The engine's `isolation:'worktree'` is per-*agent*, so spec→implement→qa→commit must share a single agent to share one working tree; separate agents would strand qa/commit in the main repo. The QA-gate is therefore in-prompt, not a separate gating agent.
- **Concurrency is honored by chunking** (sequential batches of `CAP`), never by `slice(0, CAP)` truncation (which silently dropped the wave tail — an E199 violation).
- **`blocked` ≠ `failure`**: a blocked epic stays pending (resume retries) and emits `flow_blocked`; only `failure` marks ❌.

See `docs/epics/e216-athena-flow.md` § Validation for details. Fixture test: 20/20.
