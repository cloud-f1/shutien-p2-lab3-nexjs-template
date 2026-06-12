# E193 — Pipeline-Boundary Event Instrumentation

> Phase 47 — Foundation Truth | Size: L (16 SP) | Deps: none
>
> _Expanded in the Cycle 21 addendum (2026-05-30) to absorb the completeness audit's hook-firing root-cause, Rule 6 read-only, and dual-OpenAPI reconcile findings._

## Problem

`.claude/audit.jsonl` is gitignored and currently holds 61 events — **all of them memory-subsystem events** (35 `tier0_loaded`, 13 `strength_reinforced`, 9 `auto_promote_proposed`, 3 `consolidation_detected`, 1 `plan_brainstorm`). Zero pipeline events exist: no `commit`, `merge`, `qa_result`, `autopilot_advance`, or `autopilot_pause` has ever been emitted. (`review_loop` events are emitted by `scripts/reviewer-loop.sh` but the current emit lacks the `epic` field; `verification_check` events are emitted separately by `audit-emit-verification.sh` for Rule #23.) Verified against the live log as of 2026-05-30.

The downstream consequences are concrete and measurable. `scripts/confidence/qa.sh` reads `review_loop` events to compute a round-factor score; when the event is absent it defaults to `rounds=99`, which collapses the round-factor to `0.4` — permanently deflating every confidence score regardless of actual review quality. `/athena:metrics` (default mode) aggregates `agent_complete` events; because nothing emits them the command prints "No agent metrics recorded yet" on every invocation. `docs/context/autopilot-log.md` has zero data rows because `autopilot_advance` / `autopilot_pause` are never written. The entire observability and autopilot-validation story rests on an empty event substrate.

This is a **structural gap, not a usage gap** — the commands that should emit events (`loop.md`, `batch.md`, `qa.md`) contain no emit calls. `scripts/reviewer-loop.sh` already emits `review_loop` via a `printf` pattern but the emit lacks the `epic` field; `scripts/autopilot.sh` already emits `autopilot_advance` / `autopilot_pause` via the same pattern but does not use the canonical helper. Running those two scripts can populate the log, but the events are incomplete or inconsistent without the unified helper and `epic` field.

**Deeper root cause (completeness audit, 2026-05-30):** even the always-on `bash` events are absent — `scripts/hooks/post-bash-log.sh` writes a valid line when fed proper input, yet zero `bash` / `agent_complete` events reach the log, so the PostToolUse(Bash) hooks are **not firing (or not receiving `tool_result`) in this environment** while SessionStart clearly does. Emit calls are necessary but not sufficient if the PostToolUse layer is dead. Two adjacent guard bugs surfaced in the same scan and fold in here because they touch the same observability/Stop surface: (a) **Rule 6** (OpenAPI drift) runs `cd client && pnpm generate:types` *inline during the Stop hook*, which **mutates** `client/src/api/types.ts` — a read-only verifier writing the working tree; (b) two OpenAPI files exist — `docs/openapi.yaml` (31KB, the documented SSOT) and `docs/openapi/openapi.yaml` (3.4KB, what `generate:types` actually bundles) — and Rule 6 greps `^docs/openapi` (matches both) but regenerates from the *small nested* file, a latent source-of-truth split.

## Solution

### 1. New emit helper — `scripts/hooks/audit-emit-pipeline.sh`

Mirrors the existing `scripts/hooks/audit-emit-verification.sh` and the `jq -n -c` pattern used by `tier0_loaded`. Single entry-point: `audit-emit-pipeline.sh <event> [key=value ...]`. Always terminates with `|| true` — never blocks a pipeline step.

### 2. Emit wiring (one call per boundary)

| Call site | Event | Key payload fields |
|---|---|---|
| `loop.md` inline commit step | `commit` | `epic`, `sha` |
| `loop.md` inline merge step | `merge` | `epic`, `pr` |
| `batch.md` inline commit step | `commit` | `epic`, `sha` |
| `batch.md` inline merge step | `merge` | `epic`, `pr` |
| `qa.md` after coverage gate | `qa_result` | `epic`, `coverage`, `verdict` |
| `scripts/reviewer-loop.sh` round close | `review_loop` | `epic`, `rounds`, `verdict` |
| `scripts/autopilot.sh` advance decision | `autopilot_advance` | `epic`, `step`, `score` |
| `scripts/autopilot.sh` pause decision | `autopilot_pause` | `epic`, `step`, `score` |

### 3. Canonical event schemas

```json
{"ts":"2026-05-30T10:00:00Z","event":"commit","epic":"E193","sha":"abc1234"}
{"ts":"2026-05-30T10:01:00Z","event":"merge","epic":"E193","pr":"176"}
{"ts":"2026-05-30T10:02:00Z","event":"qa_result","epic":"E193","coverage":"92.1","verdict":"pass"}
{"ts":"2026-05-30T10:03:00Z","event":"review_loop","epic":"E193","rounds":"2","verdict":"CONVERGED"}
{"ts":"2026-05-30T10:04:00Z","event":"autopilot_advance","epic":"E193","step":"implement","score":"0.87"}
{"ts":"2026-05-30T10:05:00Z","event":"autopilot_pause","epic":"E193","step":"qa","score":"0.51"}
```

### 4. Consumer fixes

- `scripts/confidence/qa.sh`: remove the `rounds=99` fallback; read real `review_loop` events.
- `/athena:metrics` (`metrics.md`): query `commit`/`merge`/`qa_result` events to populate the agent-metrics view.

### 5. Documentation

`scripts/hooks/CLAUDE.md` gains a new "Pipeline Events" section alongside the existing E180 retrieval-event schema, listing all six event names, their fields, and the emit helper usage.

### 6. Hook-firing diagnosis + Rule 6 read-only + dual-OpenAPI reconcile (audit follow-on)

- **Diagnose PostToolUse(Bash) hook firing.** Confirm whether `post-bash-log.sh` / `post-bash-failure-inject.sh` actually receive `tool_result`; fix the wiring (or document the environment limitation + a workaround) so `bash` + `agent_complete` events flow. Without this, the emit calls above land but the broader metrics stay starved.
- **Make Rule 6 read-only.** Generate types to a temp path (or `--dry-run` diff) and compare, instead of overwriting `client/src/api/types.ts` mid-Stop. A verifier must never mutate the working tree.
- **Reconcile the dual OpenAPI source.** Pick ONE canonical spec path: either point `generate:types` at `docs/openapi.yaml` (the documented SSOT) or declare `docs/openapi/openapi.yaml` canonical in the docs — then tighten Rule 6's grep so it watches only the real source.

## Key Files

| File | Action |
|---|---|
| `scripts/hooks/audit-emit-pipeline.sh` | New — emit helper, `|| true` safe |
| `.claude/commands/athena/loop.md` | Edit — add emit calls at commit + merge steps |
| `.claude/commands/athena/batch.md` | Edit — add emit calls at commit + merge steps |
| `.claude/commands/athena/qa.md` | Edit — add `qa_result` emit after coverage gate |
| `scripts/reviewer-loop.sh` | Verify/Edit — confirm or wire `review_loop` emit at round close |
| `scripts/autopilot.sh` | Verify/Edit — emit calls exist; add `epic` field and/or migrate to `audit-emit-pipeline.sh` helper |
| `scripts/confidence/qa.sh` | Edit — remove `rounds=99` fallback; read real events |
| `.claude/commands/athena/metrics.md` | Edit — query pipeline events in agent-metrics view |
| `scripts/hooks/CLAUDE.md` | Edit — add Pipeline Events schema section |
| `scripts/hooks/post-bash-log.sh` + `.claude/settings.json` | Verify/Edit — diagnose why PostToolUse(Bash) events don't fire |
| `scripts/hooks/stop-verifier.sh` | Edit — Rule 6 read-only (no tree mutation); watch the canonical OpenAPI path only |
| `docs/openapi.yaml` / `docs/openapi/openapi.yaml` | Reconcile — one canonical spec; align `generate:types` + Rule 6 |

## Implementation

1. Author `scripts/hooks/audit-emit-pipeline.sh` — accept `<event>` plus variadic `key=value` pairs; emit single-line JSON via `jq -n -c`; append to `.claude/audit.jsonl`; close with `|| true`
2. Edit `loop.md` — add `audit-emit-pipeline.sh commit epic=$EPIC sha=$(git rev-parse --short HEAD) || true` at the inline commit step; same pattern for `merge epic=$EPIC pr=$PR_NUMBER || true`
3. Edit `batch.md` — same two emit calls at its own commit + merge steps
4. Edit `qa.md` — after the coverage gate result is determined, add `audit-emit-pipeline.sh qa_result epic=$EPIC coverage=$COV verdict=$VERDICT || true`
5. Edit `scripts/reviewer-loop.sh` — the `review_loop` emit already exists (E162-wired `printf` in `emit_audit()`); add an `epic` field (parsed from current branch) and migrate to `audit-emit-pipeline.sh review_loop epic=$EPIC rounds=$ROUNDS verdict=$VERDICT || true` at round-close for format consistency
6. Verify `scripts/autopilot.sh` — emit calls already exist at each advance/pause decision branch; confirm the emitted events include an `epic` field and migrate to `audit-emit-pipeline.sh` helper if needed for consistency
7. Fix `scripts/confidence/qa.sh` — replace the `rounds=99` default with a real event query against `.claude/audit.jsonl`; preserve existing score math
8. Edit `metrics.md` — add a pipeline-events aggregate block that counts `commit`/`merge`/`qa_result` events and displays them in the agent-metrics view
9. Edit `scripts/hooks/CLAUDE.md` — add "Pipeline Events (E193)" section with all six event schemas and helper usage example

## Acceptance Criteria

- [ ] `scripts/hooks/audit-emit-pipeline.sh` exists, is executable, and emits well-formed JSONL to `.claude/audit.jsonl` without ever exiting non-zero
- [ ] After a real `/athena:loop` commit step, a `commit` event appears in `.claude/audit.jsonl` with `epic` and `sha` fields
- [ ] After a real `/athena:loop` merge step, a `merge` event appears in `.claude/audit.jsonl` with `epic` and `pr` fields
- [ ] After a real `/athena:qa` coverage-gate pass or fail, a `qa_result` event appears with `epic`, `coverage`, and `verdict` fields
- [ ] `scripts/reviewer-loop.sh` emits `review_loop` with `epic`, `rounds`, and `verdict` fields; `scripts/confidence/qa.sh` reads the real event and no longer defaults to `rounds=99`
- [ ] After a real autopilot advance decision, `autopilot_advance` appears in the log; after a pause decision, `autopilot_pause` appears
- [ ] `/athena:metrics` (default mode) displays non-memory pipeline events rather than "No agent metrics recorded yet"
- [ ] All emit calls include `|| true` — verified by `grep -n '|| true'` in each edited file
- [ ] `scripts/hooks/CLAUDE.md` Pipeline Events section lists all six event schemas
- [ ] PostToolUse(Bash) hook-firing **root cause documented** in `scripts/hooks/CLAUDE.md` — if it's a config bug, fix it so `bash` events flow; if it's a Claude Code platform constraint (hook not receiving `tool_result`), record the limitation + workaround. Does NOT require `bash` events to appear when the cause is external to the repo.
- [ ] Rule 6 no longer mutates `client/src/api/types.ts` — verified by a clean `git status` after a Stop with an unchanged spec
- [ ] Single canonical OpenAPI source: `generate:types` and Rule 6 read the same file; the other is removed or generated from it

## Alignment / Cross-Epic Hooks

- **Independent epic** — no blocking deps; ships as Wave 1 of Phase 47.
- **Hard prerequisite for Phase 48**: E199 directly depends on E193; E200 and E201 depend on E198 which depends on E193 — all three consume `commit`/`qa_result`/`review_loop` events and cannot produce meaningful output without this substrate.
- **Reuses E180 audit-log infrastructure** — same `.claude/audit.jsonl` append target and `jq -n -c` emit pattern as `tier0_loaded` / `rule_fired` / `agent_cited`.
- **Reuses E188 emit helper pattern** — `audit-emit-pipeline.sh` is a direct sibling of `audit-emit-verification.sh`.
- **Closes E162 emit gap** — E162 wired `review_loop` emission in `scripts/reviewer-loop.sh` (the emit exists), but the event lacks the `epic` field required by downstream consumers; this epic adds it and unifies the format.

## Out of Scope

- Re-enabling CI workflows — owner disabled them deliberately on 2026-05-20; this epic does not touch `.github/workflows/`
- Building a metrics UI — dashboard rendering is Phase 48 territory; this epic only populates the event substrate
- Backfilling historical events — existing 61 events are not retroactively modified
- Per-epic event filtering or retention policies — v1 appends unconditionally; pruning is a future concern
- Emitting events from human-triggered git operations — only athena command and script boundaries are instrumented

## Provenance

- Spec source: 2-workflow enhancement audit (athena-enhancement-research + ultracode-into-athena), 2026-05-30
- Approved via `/athena:plan approve E193,E194,E195,E196,E197` on 2026-05-30 (Cycle 21); Phase 48/49 rendered same day under "no limit 5 epics" override
