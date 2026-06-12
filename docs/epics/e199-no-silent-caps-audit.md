# E199 — No-Silent-Caps Audit + /metrics --effort

> Phase 48 — Ultracode Orchestration | Size: S (8 SP) | Deps: E193, E198

## Problem

When orchestration hits a hard cap — `--max-concurrent 1` fallback in `batch.md`'s Step 3.5 two-layer probe, `MAX_ITERATIONS` reached in `scripts/reviewer-loop.sh`, or a top-N sampling gate in `/athena:metrics --memory`'s seven-section dashboard — the run completes silently and the output reads as "covered everything". There is no audit artifact distinguishing "swept all items" from "stopped at N because isolation was broken". The caller has no way to know coverage was truncated.

This is the same honesty gap that E188 closed for verification claims: structure checks pass, audit log is clean, and yet a meaningful bound was silently applied. In the case of `--max-concurrent 1` auto-fallback (PR #161, Phase 45 hardening), the batch summary log shows the degraded concurrency value, but `.claude/audit.jsonl` contains no `coverage_dropped` event — so `/athena:metrics`, `/athena:dashboard`, and any downstream consumer that queries the audit log see no evidence of the cap.

The companion gap is on the metrics side: `/athena:metrics` (`.claude/commands/athena/metrics.md` + its aggregation helper) has no `--effort` section. Effort level is currently a soft knob agents set per-call with no measurable outcome tied to it — it does not appear in `audit.jsonl`, is not correlated against `review_loop` verdicts, and has no tier distribution report. That makes effort a marketing label, not an observable.

## Solution

Two coordinated additions:

### 1. `scripts/hooks/audit-emit-coverage-drop.sh` (new helper)

Emits a `coverage_dropped` event to `.claude/audit.jsonl` **only when a cap is actually hit** — not as a per-tier confessional that would log non-events on every clean run. Single-call interface:

```bash
audit-emit-coverage-drop.sh <what> <reason> <tier>
# e.g.
audit-emit-coverage-drop.sh "batch_concurrency" "worktree_isolation_broken" "orchestration"
audit-emit-coverage-drop.sh "reviewer_loop" "MAX_ITERATIONS_reached" "review"
audit-emit-coverage-drop.sh "metrics_top_n" "sample_cap_hit" "memory"
```

Event schema (matches established `jq -n -c` pattern from E180):

```json
{"ts":"2026-05-30T10:00:00Z","event":"coverage_dropped","what":"batch_concurrency","reason":"worktree_isolation_broken","tier":"orchestration"}
```

### 2. Callsite wiring (edits to existing files)

| Callsite | Cap condition | Emits |
|---|---|---|
| `.claude/commands/athena/batch.md` Step 3.5 fallback branch | `--max-concurrent 1` forced | `what=batch_concurrency, reason=worktree_isolation_broken, tier=orchestration` |
| `scripts/reviewer-loop.sh` MAX_ITERATIONS branch | rounds == 4, verdict=MAX_REACHED | `what=reviewer_loop, reason=MAX_ITERATIONS_reached, tier=review` |
| Any future top-N/sampling cap | N < total items | caller-supplied `what` + `reason` |

### 3. `/athena:metrics --effort` section (new)

Extend `.claude/commands/athena/metrics.md` and the metrics aggregation helper with a new `--effort` flag that renders three sub-sections from `audit.jsonl`:

- **Effort tier distribution** — count of `effort_resolved` events by tier (quick / standard / thorough / ultra)
- **Coverage-drop frequency** — count of `coverage_dropped` events grouped by `tier` field, last 30 days
- **Effort vs. review_loop verdict correlation** — join `effort_resolved` + `review_loop` events on epic/ts window; render CONVERGED / STUCK / MAX_REACHED breakdown per effort tier

## Key Files

| File | Action |
|---|---|
| `scripts/hooks/audit-emit-coverage-drop.sh` | New — emit helper, mirrors `audit-emit-verification.sh` |
| `scripts/hooks/tests/test-coverage-drop.sh` | New — 6+ fixtures (cap-hit path vs. no-cap path, schema validation) |
| `.claude/commands/athena/batch.md` | Edit — call `audit-emit-coverage-drop.sh` in Step 3.5 `--max-concurrent 1` fallback branch |
| `scripts/reviewer-loop.sh` | Edit — call `audit-emit-coverage-drop.sh` in `MAX_ITERATIONS` branch (verdict=MAX_REACHED) |
| `.claude/commands/athena/metrics.md` | Edit — add `--effort` section (tier dist + drop freq + correlation) |
| `scripts/memory/metrics.sh` | Edit — implement `--effort` aggregation queries against `audit.jsonl` |
| `scripts/hooks/CLAUDE.md` | Edit — document `coverage_dropped` event in schema table |

## Implementation

1. Author `audit-emit-coverage-drop.sh` — single entry point; validate 3 required args; emit JSONL to `.claude/audit.jsonl` using `jq -n -c`; `chmod +x`
2. Write `test-coverage-drop.sh` fixtures — at minimum: (a) cap-hit path emits valid JSON with correct fields, (b) no-cap path emits nothing, (c) missing-arg path exits non-zero without writing, (d) schema field presence check; target <2s runtime
3. Wire `batch.md` Step 3.5 — locate the `--max-concurrent 1` auto-fallback prose; add a code block showing the emit call immediately after the fallback is triggered; update the Step 3.5b description
4. Wire `scripts/reviewer-loop.sh` — locate `MAX_ITERATIONS` / `MAX_REACHED` branch; insert `audit-emit-coverage-drop.sh` call with `what=reviewer_loop reason=MAX_ITERATIONS_reached tier=review`
5. Implement `--effort` aggregation in the metrics helper — three `jq` queries against `.claude/audit.jsonl`: (a) `effort_resolved` count by tier, (b) `coverage_dropped` count grouped by `.tier`, (c) joined window query for effort-vs-verdict correlation
6. Update `metrics.md` — add `--effort` flag documentation with example output block showing all three sub-sections
7. Update `scripts/hooks/CLAUDE.md` — add `coverage_dropped` row to the event schema table
8. Run `test-coverage-drop.sh`; confirm all fixtures green; confirm `audit.jsonl` receives the event on a synthetic `--max-concurrent 1` replay

## Acceptance Criteria

- [ ] `scripts/hooks/audit-emit-coverage-drop.sh` exists, is executable, and emits a well-formed JSONL line with fields `ts`, `event`, `what`, `reason`, `tier` to `.claude/audit.jsonl` when called with a real cap hit
- [ ] The helper emits **nothing** when called without the required args (exits non-zero; no partial JSON written)
- [ ] `batch.md` Step 3.5 `--max-concurrent 1` fallback path includes the `audit-emit-coverage-drop.sh` call so that forcing a broken-worktree scenario produces a `coverage_dropped` event in `audit.jsonl`
- [ ] `scripts/reviewer-loop.sh` `MAX_ITERATIONS` / `MAX_REACHED` branch calls the helper; a synthetic 4-round-exceeded run produces a `coverage_dropped` event
- [ ] `/athena:metrics --effort` renders three sub-sections: effort tier distribution, coverage-drop frequency by tier, and effort-vs-review_loop-verdict correlation — all sourced from `audit.jsonl`
- [ ] `test-coverage-drop.sh` covers ≥6 fixtures (cap-hit / no-cap / bad-args / schema-check / batch-callsite / reviewer-callsite) and runs in <2s
- [ ] `coverage_dropped` events conform to the schema documented in `scripts/hooks/CLAUDE.md`
- [ ] No `coverage_dropped` event is emitted during a normal, uncapped `/athena:batch` or reviewer-loop run (no false positives)

## Alignment / Cross-Epic Hooks

- **Deps**: E193 (pipeline event infrastructure — JSONL schema + audit.jsonl vocabulary that `effort_resolved` joins); E198 (effort dial foundation — defines `effort_resolved` events consumed by `--effort` correlation query, and introduces new cap callsites via `ultra` concurrency)
- **Reuses E180 audit-log infrastructure** — same `jq -n -c` emit pattern as `tier0_loaded`, `rule_fired`, `agent_cited`, `plan_brainstorm`, `verification_check`
- **Mirrors E188 Stop Rule #23 pattern** — `audit-emit-coverage-drop.sh` is a direct structural sibling of `audit-emit-verification.sh`; both emit to `audit.jsonl`, both have dedicated test fixtures
- **Unblocks**: future auto-retry logic on `coverage_dropped` (explicit out-of-scope for v1 but the event is the prerequisite); `/athena:dashboard` can surface drop frequency once events exist

## Out of Scope

- Auto-retry or escalation on `coverage_dropped` — defer; v1 makes the drop visible, not actionable automatically
- A metrics dashboard UI — `/athena:metrics --effort` is a CLI text report only
- Emitting `coverage_dropped` from every possible partial-scan site (e.g., top-N in `/athena:metrics --memory` Block B inject) — v1 covers the two highest-impact callsites (batch fallback + reviewer-loop MAX_REACHED); additional callsites are additive follow-ups
- Configurable thresholds for what constitutes a "cap" — hardcoded per-callsite in v1

## Provenance

- Spec source: 2-workflow enhancement audit (athena-enhancement-research + ultracode-into-athena), 2026-05-30
- Approved via `/athena:plan approve E193,E194,E195,E196,E197` on 2026-05-30 (Cycle 21); Phase 48/49 rendered same day under "no limit 5 epics" override
