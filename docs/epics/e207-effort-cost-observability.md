# E207 — Effort→Cost Observability

> Phase 50 — Operationalize the Dial | Size: M (10 SP) | Deps: none (builds on shipped E198 + E199)

## Problem

The effort dial is described as a **cost dial** — "tier = fan-out width × model tier × verification depth" — but no data backs that claim. `scripts/effort/resolve.sh` resolves a full cost profile per tier (`ATHENA_MODEL_MAP="reviewer=...,evaluator=..."`, `MAX_CONCURRENT`, `MAX_ITERATIONS`, `ATHENA_VERIFY_POSTURE`), yet the `effort_resolved` audit event it emits (resolve.sh line 166) carries only `{"ts","event","tier","source"}`. The model map, concurrency ceiling, and verification posture — the three multiplicands of the cost claim — are computed and then discarded at emit time.

Downstream, `/athena:metrics --effort` (E199, `effort_metrics_json()` in `scripts/memory/metrics.sh` line 419) can render tier *distribution* (count of `effort_resolved` by tier) and effort-vs-`review_loop`-verdict correlation, but it cannot show what a tier actually *costs* — because the event has no cost dimensions to aggregate. A user asking "is ultra actually more expensive than thorough, and by how much?" gets no answer. The cost dial is currently an unfalsifiable claim.

Note: this epic deliberately does **not** depend on the starved pipeline-event path. `.claude/audit.jsonl` shows real `effort_resolved` events fire (emitted directly by `resolve.sh`, not via a PostToolUse(Bash) hook), whereas `commit`/`merge`/`qa_result`/`review_loop` remain sparse due to the documented PostToolUse(Bash) hook-firing platform constraint (E193). E207 sources the event that *actually fires*.

## Solution

### 1. Enrich the `effort_resolved` payload

Add three fields to the `effort_resolved` event in `resolve.sh`:

```json
{"ts":"...","event":"effort_resolved","tier":"ultra","source":"flag",
 "model_map":"reviewer=opus,evaluator=opus","max_concurrent":8,"verify_posture":"judge-panel+adversarial+multimodal"}
```

All additive — existing consumers (E199 tier-distribution + correlation queries) read `tier`/`source` and are unaffected.

### 2. Cost-proxy column in `/metrics --effort`

Extend `effort_metrics_json()` with a fourth sub-section: **Effort Cost Proxy**. Compute a model-tier-weighted cost proxy per tier (haiku=1, sonnet=5, opus=25 as relative weight units; `cost_proxy = (reviewer_weight + evaluator_weight) × max_concurrent`). Render a table: tier · invocations · model_map · max_concurrent · cost_proxy_per_run · total_cost_proxy. The weights are documented as *relative proxies* (not dollar amounts) so the dashboard can answer "ultra is ~Nx the per-run cost of standard" without claiming precise spend.

### 3. Backward compatibility

`effort_metrics_json()` must degrade gracefully on *old* `effort_resolved` events that lack the new fields (pre-E207 events): treat missing `model_map`/`max_concurrent` as "unknown" and exclude them from the cost-proxy sum (count them only in the distribution). No crash, no NaN.

## Key Files

| File | Action |
|---|---|
| `scripts/effort/resolve.sh` | Edit — add `model_map`, `max_concurrent`, `verify_posture` to the `effort_resolved` emit (additive) |
| `scripts/memory/metrics.sh` | Edit — extend `effort_metrics_json()` with the Effort Cost Proxy sub-section; graceful handling of pre-E207 events |
| `scripts/effort/tests/test-resolve.sh` | Edit — assert the enriched payload contains the 3 new fields with correct per-tier values |
| `scripts/memory/tests/` | New/Edit — fixture: a seeded audit log with mixed old+new `effort_resolved` events → cost-proxy table renders, old events don't crash it |
| `.claude/commands/athena/metrics.md` | Edit — document the cost-proxy column + the relative-weight methodology |
| `scripts/hooks/CLAUDE.md` | Edit — update the `effort_resolved` schema row with the 3 new fields |

## Implementation

1. Edit `resolve.sh` emit (line ~166): add `model_map`, `max_concurrent`, `verify_posture` as `jq` args. Confirm `standard` tier still emits a valid line and `test-resolve.sh` passes.
2. Extend `test-resolve.sh`: per-tier assertions on the 3 new fields (e.g. ultra → `model_map="reviewer=opus,evaluator=opus"`, `max_concurrent` = the cores-capped value, `verify_posture="judge-panel+adversarial+multimodal"`).
3. Write the metrics fixture FIRST (TDD): seed a temp audit log with 2 pre-E207 events (no cost fields) + 3 post-E207 events; assert the cost-proxy table sums only the enriched ones and the old ones appear in the distribution count without error.
4. Extend `effort_metrics_json()`: parse the new fields, compute the weighted proxy, emit the table; guard missing fields with `// "unknown"` jq fallbacks.
5. Update `metrics.md` + `scripts/hooks/CLAUDE.md` docs.
6. Run `/athena:metrics --effort` against the live audit log; confirm it renders without error on the existing mix of events.

## Acceptance Criteria

- [ ] `effort_resolved` events emitted by `resolve.sh` include `model_map`, `max_concurrent`, and `verify_posture` with correct per-tier values (verified for all 4 tiers in `test-resolve.sh`)
- [ ] `/athena:metrics --effort` renders an Effort Cost Proxy table: tier · invocations · model_map · max_concurrent · cost_proxy_per_run · total — sourced from `effort_resolved` events
- [ ] The cost proxy uses documented relative weights (haiku=1 / sonnet=5 / opus=25) × concurrency; the dashboard states these are relative proxies, not dollar amounts
- [ ] Pre-E207 `effort_resolved` events (lacking the new fields) do NOT crash the dashboard — they count in tier distribution but are excluded from the cost-proxy sum (graceful degradation, verified by mixed-event fixture)
- [ ] Existing E199 sub-sections (tier distribution, coverage-drop frequency, effort-vs-verdict correlation) are unchanged — no regression
- [ ] `scripts/hooks/CLAUDE.md` `effort_resolved` schema row lists all fields including the 3 new ones
- [ ] All new/edited tests pass in <3s with no external dependencies

## Alignment / Cross-Epic Hooks

- **Builds on E198** (shipped) — enriches the `effort_resolved` event `resolve.sh` already emits.
- **Builds on E199** (shipped) — extends `effort_metrics_json()` and the `/metrics --effort` command rather than adding a new surface.
- **Closes the Phase 48 loop** with E206 — E206 makes ultra deliver, E207 makes its cost visible. Ship together.
- **Works WITH the platform constraint** — sources `effort_resolved` (fires reliably via direct script invocation), not the PostToolUse(Bash)-starved pipeline events.

## Out of Scope

- Real dollar-cost accounting (token-count × price) — relative proxy only; true spend needs per-call token capture that the headless path doesn't surface uniformly.
- Capturing actual model usage from `claude -p` envelopes (the `modelUsage` field) — a richer follow-up; v1 uses the *resolved* map as the cost intent, not measured spend.
- Per-epic cost attribution — tier-level aggregation only for v1.
- Backfilling cost fields onto historical `effort_resolved` events — forward-only.

## Provenance

- Spec source: `/athena:plan auto` Cycle 22 (2026-06-02) — the "cost dial has no data" finding; pairs with E206 to close the Phase 48 dial loop.
- Approved via `/athena:plan approve E206,E207,E208,E209,E210` on 2026-06-02 (Cycle 22).
