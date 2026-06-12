# E216 — `/athena:flow` — Interactive Native-Workflow Epic Dispatcher

> Phase 52 — Native Workflow Orchestration | Size: M (8 SP) | Deps: E198 (effort tiers), E201 (AgentReport schema) — soft

## Problem

`/athena:batch` is the only multi-epic dispatcher, and its sole structured-output path is the
`claude -p --output-format json --json-schema` **subprocess IPC** shipped by E200/E201
(`scripts/qa/verify-panel.sh:6,127`). Two structural gaps follow:

1. **No enforced budget.** `REVIEW_LOOP_BUDGET` is *informational only* — `scripts/reviewer-loop.sh:16`
   labels it so, line 126 merely emits it into the audit event, and the loop exits on
   findings-count / round-hash / iteration-count, **never on tokens**. The cost dial is decorative.
2. **No native in-session orchestration.** The `parallel` posture's `pipeline()`/`parallel()` are
   *prose doc-strings* (a test asserts `grep -q 'pipeline()'` against the markdown), not the harness
   Workflow API. The native `Workflow` engine (`agent({schema})`, `budget`, `pipeline()`, live
   `/workflows` tree) is used **nowhere** in athena, and `batch.md:3` `allowed-tools` does not grant it.

Net: an interactive operator who wants deterministic control flow, a *real* hard token ceiling, a
live progress tree, and zero subprocess has no command for it. (Established via the 9-agent
`athena-workflow-integration-v2` analysis whose adversarial critic verified every fact above.)

## Solution

Add an **interactive-only** sibling command, `/athena:flow`, that drains the epic dependency graph
through `spec → implement → qa → commit` using the **native Workflow engine** — never `claude -p`.
Two planes:

- **Outer plane** (`flow.md` prose, obeyed by the main-loop): resolve effort → probe for the
  `Workflow` tool (auto-delegate to `/athena:batch` if absent) → plan pending waves via
  `epic-graph.sh --json --pending-only` (skipping ✅ in `epic-progress.md` = resume) → loop waves,
  launching one Workflow per wave, write back after each → **never merge**.
- **Inner plane** (one per-wave Workflow JS, authored with pure-literal wave/cap/model data):
  `pipeline()` each epic independently through the four stages (implement worktree-isolated),
  `log()` per epic, `budget.remaining()` guard, returns `AgentReport[]`.

`/athena:batch` is untouched and remains the portable, headless/cron, plugin-shipped path; `/athena:flow`
is the interactive accelerant. They are complements: `flow` cannot run headless (Workflow is a
main-loop tool), `batch` cannot enforce a budget or show a live tree.

## Key Files

| File | Action |
|---|---|
| `.claude/commands/athena/flow.md` | New — the command. Frontmatter grants `Workflow` (the grant `batch.md` lacks). Sections: When-to-use · Step 0 effort · Step 1 probe+delegate · Step 2 wave plan · Step 3 wave loop · Step 4 write-back · Agent Report Schema · Step 5 Workflow template |
| `scripts/flow-tests/test-flow-command.sh` | New — 20-assertion static fixture test (mirrors `scripts/batch-tests/test-e201-schemas.sh`): Workflow grant, delegation event, pending-only planning, schema fields, `pipeline()`, worktree isolation, `budget.remaining()`, negation-aware "no `claude -p` invocation", write-back targets, merge-excluded, count-cap, **no-silent-wave-truncation guard** |
| `scripts/epic-graph.sh` | Reused — `--json --pending-only` wave source |
| `scripts/effort/resolve.sh` | Reused — `MAX_CONCURRENT` / `REVIEW_LOOP_BUDGET` / `ATHENA_MODEL_MAP` injected as literals |
| `scripts/hooks/audit-emit-pipeline.sh` | Reused — `flow_delegated_to_batch`, `commit`, `qa_result` events |
| `docs/superpowers/specs/2026-06-04-athena-flow-design.md` | Source spec |
| `docs/superpowers/plans/2026-06-04-athena-flow.md` | Source TDD plan (6 tasks) |

## Implementation

Built TDD on branch `feat/athena-flow` (commits `d5f9939` → `14e9ef7`):

1. **Task 1** — scaffold `flow.md` frontmatter (grants `Workflow`, `Agent`) + test harness. → `PASS=2`
2. **Task 2** — Step 0 effort resolution + Step 1 capability probe + `flow_delegated_to_batch` delegation. → `PASS=5`
3. **Task 3** — Step 2 pending-only wave planning + `epic-progress.md` resume/skip. → `PASS=7`
4. **Task 4** — Agent Report Schema + Step 5 per-wave Workflow template (`pipeline()`, worktree isolation, `budget.remaining()` guard); fixed a false-positive test (negation-aware "no `claude -p` invocation"). → `PASS=16`
5. **Task 5** — Step 3 outer wave loop (count-cap backstop) + Step 4 write-back + merge-excluded. → `PASS=19`
6. **Task 6** — verification: flow test `PASS=19 FAIL=0`; `e201` regression `14/14` (batch.md untouched); `make drift-check` flags `flow.md` as new in `athena-core` (expected — export via `sync-to-plugin.sh --apply` is a separate user-driven step per E202). No aggregator exists, so the test stays standalone like its sibling.

## Validation (2026-06-04 — adversarial audit)

After the 6-task build, `flow.md` was audited against the real Workflow-engine API contract (one adversarial subagent + a focused re-review). Engine mechanics (meta purity, `pipeline()` arity, `budget` guard, schema, no-subprocess, no-forbidden-builtins) all passed. **Three correctness bugs were found and fixed** (commit after `14e9ef7`):

1. **Silent wave truncation** — `pipeline(WAVE.slice(0, CAP), …)` dropped every epic beyond `CAP` (violated E199 no-silent-caps). Fixed: chunked sequential batches of `CAP` (`slice(i, i+CAP)`) that run *all* epics; the engine auto-caps concurrency. Added a regression assertion (test #20).
2. **Cross-agent worktree stranding** — `qa`/`commit` were separate non-isolated agents merely *told* `impl.worktreePath`; since `isolation:'worktree'` is per-*agent*, they ran in the main repo and could not see implement's changes. Fixed: fused spec→implement→qa→commit into **one** worktree-isolated agent per epic (qa-gate now in-prompt). Matches the spirit of batch's inline-commit pattern.
3. **`blocked` mis-marked as failure** — Step 4 lumped `failure|blocked` → both ❌ + `verdict=fail`. Fixed: `blocked` now stays **pending** (resume retries) and emits a neutral `flow_blocked` event; only genuine `failure` → ❌.

Trade-off accepted: fusing the per-epic pipeline into one agent moves the QA-gate from engine-enforced (a separate gating agent) to in-prompt enforced — the necessary cost of the engine's per-agent worktree model.

## Acceptance Criteria

- [x] `/athena:flow` command exists with `Workflow` granted in `allowed-tools`.
- [x] Runs `spec → implement → qa → commit` per epic via native `agent({schema})` (no `claude -p`).
- [x] All ready waves until budget exhausted; per-wave write-back + per-epic `log()`; resume via `epic-progress.md`.
- [x] Auto-delegates to `/athena:batch` + emits `flow_delegated_to_batch` when Workflow is unavailable.
- [x] Merge stays outside the Workflow span (outer-plane, gated).
- [x] 19-assertion fixture test green; `e201`/batch regression clean.
- [x] Merged to `main` via PR #205 (squash auto-merge). Export to `athena-core` via `sync-to-plugin.sh --apply` still pending (separate user step).

## Cross-Epic

- **Completes the E198–E201 line** (Ultracode Orchestration): E198 effort tiers + E201 AgentReport schema are reused 1:1; E216 adds the *native-engine* interactive path those epics scaffolded in prose/IPC.
- **Does not modify** `/athena:batch` (`standard`/`parallel` postures) or the human-gated `/loop` · `/autopilot` · `/cycle`.
- **Budget wiring**: closes the verified `REVIEW_LOOP_BUDGET`-is-informational gap via native `budget.remaining()` (mechanism a) + outer count-cap (mechanism b).

## Out of Scope (YAGNI)

- Headless/cron `flow` (that is `batch`'s job — Workflow is main-loop-only).
- Folding `flow` into `batch` as a `--flow` flag (kept a clean standalone sibling).
- Retiring the Step 3.5 isolation probe (native worktree isolation unvalidated — keep both).
- Any change to `batch`'s postures or the human-gated commands.
