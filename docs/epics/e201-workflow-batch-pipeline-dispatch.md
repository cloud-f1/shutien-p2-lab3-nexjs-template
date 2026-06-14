# E201 — Workflow-native /athena:batch Pipeline Dispatch

> Phase 48 — Ultracode Orchestration | Size: L (16 SP) | Deps: E198, E200

## Problem

`.claude/commands/athena/batch.md` Step 4 is a hand-rolled wave engine written entirely in prose. `scripts/epic-graph.sh` emits `{waves:[{wave,epics[]}]}` as a topological ordering, but Step 4 then manually throttles to `--max-concurrent` (hardcoded 4), manually enforces a wave barrier ("all agents in a wave must complete before the next wave starts"), dispatches each epic via `Agent-tool isolation:'worktree'`, and collects agent results as **free-text reports** with a convention of `Status: success/failure / Files changed: list / Summary: ...`. Every one of these mechanisms is hand-written prose the model must interpret correctly at runtime.

The wave-barrier design imposes unnecessary wall-clock cost: if Wave 1 has one 1-file epic and one 10-file epic, the fast epic must wait for the slow one before Wave 2 starts. The real constraint is dependency order (which `epic-graph.sh` already encodes), not synchronous wave completion. A pipeline-per-epic model lets a fast epic reach `commit` while a slow sibling is still in `implement`, reducing total elapsed time to the slowest single chain rather than the sum of per-wave slowest paths.

The most dangerous failure mode is silent QA bypass. The Mandatory-Pipeline-Order rule (`spec → implement → qa → commit`, the "Mandatory Pipeline Order (NEVER SKIP)" section in batch.md) is honor-system prose: if an agent misreads a free-text report and concludes success, it can advance an epic to `commit` without a `qa` stage having run. There is no structural enforcement. Schema-less free-text reports are the root cause — a misidentified `Status: success` string is enough to skip QA entirely.

Step 3.5's worktree isolation probe is critical safety infrastructure but its verdict is consumed via substring-matching on a freeform string (`ISOLATION_VERDICT: SHARED`), making it brittle to agent paraphrase. The probe must be retained and its verdict made schema-typed.

## Solution

Batch Step 4 gains a **Workflow-native dispatch path** that replaces the hand-rolled wave engine with a `pipeline()` composition per epic and a `parallel()` gate only where genuinely required.

### 1. Per-epic `pipeline()` dispatch

Each epic independently flows through stages with no cross-epic synchronization barrier:

```
pipeline(epic, spec, implement, qa, commit)
```

- `spec` → `implement` → `qa` → `commit` are literal unskippable pipeline stages; the Workflow executor enforces ordering — not prose
- A fast epic proceeds to `commit` independently of slower siblings (wall-clock = slowest single chain)
- `parallel()` is reserved **only** for the post-merge E91 integration gate, where all epics genuinely must complete before a shared assertion

### 2. Schema-forced agent reports

Agent step reports become a typed object — model must return this shape or the Workflow retries:

```json
{
  "status": "success" | "failure" | "blocked",
  "filesChanged": ["server/app/...", "client/src/..."],
  "worktreePath": "/path/to/worktree",
  "worktreeBranch": "feat/E{n}-{slug}",
  "summary": "<one-line>"
}
```

Freeform text responses are rejected; the QA-skip bug class (misread report → skipped stage) is eliminated structurally.

### 3. Schema-typed Step 3.5 worktree probe

The existing pre-dispatch probe is retained but its output is a typed verdict field:

```json
{
  "pwd": "/worktrees/E{n}",
  "branch": "feat/E{n}-{slug}",
  "isolationVerdict": "ISOLATED" | "SHARED"
}
```

`SHARED` verdict triggers the existing auto-fallback to `--max-concurrent 1` (sequential); substring-matching on freeform strings is eliminated.

### 4. Effort-driven concurrency + model tier

`--max-concurrent` and per-role model tier are sourced from `scripts/effort/resolve.sh` (E198) — cores-aware, not hardcoded 4. A `standard` posture reproduces today's wave behavior when single-vote is the active posture.

### Posture branch

| Posture | Dispatch mode |
|---|---|
| `standard` | Sequential wave order (today's behavior, reproduced) |
| `parallel` | `pipeline()` per epic, `parallel()` only for integration gate |

## Key Files

| File | Action |
|---|---|
| `.claude/commands/athena/batch.md` | Edit — add Workflow dispatch section; posture branch logic; schema-typed Step 3.5 verdict |
| `scripts/effort/resolve.sh` | Reuse — concurrency ceiling + model tier sourced from here (E198 output) |
| `scripts/epic-graph.sh` | Reuse — wave topological order consumed as pipeline input (no changes) |

## Implementation

1. Read current `batch.md` Step 4 prose in full; identify the exact wave-barrier loop, `--max-concurrent` literal, free-text report conventions, and Step 3.5 substring match
2. Define the agent report JSON schema (as above) and the Step 3.5 verdict schema; add both as fenced blocks in `batch.md` under a new "Schemas" subsection
3. Add posture branch: `standard` path reproduces today's sequential wave behavior; `parallel` path introduces `pipeline()` per-epic dispatch
4. Implement `pipeline()` dispatch — each epic independently traverses `spec → implement → qa → commit` stages; no cross-epic barrier except dependency edges from `epic-graph.sh`
5. Replace Step 3.5 substring-match with the schema-typed `isolationVerdict` field; wire `SHARED` → existing `--max-concurrent 1` fallback path
6. Source `--max-concurrent` and model tier from `scripts/effort/resolve.sh` (E198); remove hardcoded `4`
7. Add `parallel()` integration-gate section (post-merge, E91 hook point) as a clearly labeled stub
8. Write end-to-end test fixture: one 1-file synthetic epic + one 3-file synthetic epic; assert fast epic reaches `commit` stage before slow epic exits `implement`
9. Run `standard` posture replay against last 3 batch runs in `.claude/audit.jsonl`; assert identical wave order

## Acceptance Criteria

- [ ] `pipeline()` dispatch verified end-to-end: a fast 1-file epic reaches `commit` while a slow multi-file epic is still in `implement` (observable via per-epic audit events in `.claude/audit.jsonl`)
- [ ] Agent reports are schema-validated; a freeform response triggers a retry rather than advancing the pipeline
- [ ] `qa` stage is structurally unskippable — no code path in batch.md Step 4 can advance an epic from `implement` to `commit` without a `qa` stage completing with `status: success`
- [ ] Step 3.5 worktree probe is retained; its verdict is a schema-typed `{isolationVerdict: 'ISOLATED'|'SHARED'}` field — no substring matching on freeform text
- [ ] `SHARED` verdict triggers `--max-concurrent 1` fallback (existing behavior preserved)
- [ ] `--max-concurrent` and per-role model tier are sourced from `scripts/effort/resolve.sh`; the hardcoded `4` is removed from `batch.md`
- [ ] `standard` posture reproduces today's sequential wave behavior (replay of last 3 batch runs matches)
- [ ] `parallel()` is used only at the post-merge integration gate; no other `parallel()` calls in the dispatch path

## Alignment / Cross-Epic Hooks

- **Deps**: E198 (`scripts/effort/resolve.sh` — concurrency + model tier); E200 (headless Workflow substrate de-risked first)
- **Reuses**: `scripts/epic-graph.sh` wave output as topological pipeline input (no changes to that script)
- **Reuses**: E180 audit-log infrastructure — per-stage pipeline events follow the established JSONL schema
- **Unblocks**: E202+ ultra multi-epic autopilot waves (deferred); any epic that relies on guaranteed QA enforcement within batch dispatch

## Out of Scope

- Ultra multi-epic autopilot waves — defer; `parallel()` stub is the hook point but full autopilot is a separate epic
- Removing the worktree probe — explicitly retained; this epic makes it more robust, not optional
- Per-stage timeout configuration — defer; uniform agent timeout inherited from E198 defaults is sufficient for v1
- Migrating the `standard` posture to Workflow-native internals — `standard` posture prose is preserved as-is; only the `parallel` posture gets the new dispatch engine

## Provenance

- Spec source: 2-workflow enhancement audit (athena-enhancement-research + ultracode-into-athena), 2026-05-30
- Approved via `/athena:plan approve E193,E194,E195,E196,E197` on 2026-05-30 (Cycle 21); Phase 48/49 rendered same day under "no limit 5 epics" override
