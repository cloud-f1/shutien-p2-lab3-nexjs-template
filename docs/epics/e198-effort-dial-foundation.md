# E198 — Effort Dial Foundation

> Phase 48 — Ultracode Orchestration | Size: M (8 SP) | Deps: E193

## Problem

Athena's execution depth is hardcoded in three separate places with no shared control surface. `scripts/reviewer-loop.sh` hardcodes `MAX_ITERATIONS=4` (line 34) and `REVIEW_LOOP_BUDGET=50000` (line 35). `scripts/autopilot.sh` hardcodes `AUTOPILOT_THRESHOLD=0.85` (line 42). `.claude/commands/athena/batch.md` hardcodes `--max-concurrent 4`. Each driver independently caps its own ambition, making it impossible to scale reasoning depth or fan-out width with a single operator gesture.

This scattering means a user who wants a cheap sanity-check run (`quick`) and a user who wants a full adversarial review (`ultra`) both get identical resource consumption. There is no knob to dial down cost for fast feedback or dial up verification depth for high-stakes merges. Every invocation of `/athena:batch`, `/athena:qa`, `/athena:loop`, and `/athena:autopilot` burns the same token budget regardless of the operator's intent.

The absence of an effort tier also means the model selection is uniform: reviewer and debugger agents always run at the same model tier whether the task warrants a lightweight scan or an Opus-level adversarial pass. The cost dial and the fan-out dial are both stuck.

## Solution

Introduce `scripts/effort/resolve.sh` — a single source of truth that accepts an effort tier (`quick | standard | thorough | ultra`) and emits a bundle of shell exports that the existing drivers already read. Callers source it in their prologue via `eval "$(scripts/effort/resolve.sh "$ARGUMENTS")"`. The resolver does not modify any driver; it pre-populates the env vars those drivers already consume.

### Precedence (simple — three levels only)

`--effort <tier>` from `$ARGUMENTS` → `$ATHENA_EFFORT` env var (set in `settings.json`) → default `standard`

### Knob table

| Knob | quick | standard | thorough | ultra |
|---|---|---|---|---|
| `MAX_CONCURRENT` | 1 | 4 | 4 | min(16, cores-2) |
| `MAX_ITERATIONS` | 1 | 4 | 6 | 8 |
| `REVIEW_LOOP_BUDGET` | 15000 | 50000 | 150000 | 500000 |
| `AUTOPILOT_THRESHOLD` | 0.80 | 0.85 | 0.90 | 0.95 |
| `ATHENA_VERIFY_POSTURE` | single-vote | single-vote | adversarial-3+perspective | judge-panel+adversarial+multimodal |
| model: reviewer/debugger | haiku | sonnet | sonnet | opus |
| model: evaluator/synthesis judge | sonnet | sonnet | opus | opus |

**`standard` MUST reproduce today's exact numbers byte-for-byte** — omitting the dial changes no current behavior.

### Audit event

`resolve.sh` emits an `effort_resolved` event to `.claude/audit.jsonl` on every invocation, joining the E193 event vocabulary:

```json
{"ts":"2026-05-30T10:00:00Z","event":"effort_resolved","tier":"standard","source":"default"}
```

`source` is one of `flag` / `env` / `default` depending on which precedence level fired.

### cores-aware cap (ultra only)

`ultra` MAX_CONCURRENT uses `getconf _NPROCESSORS_ONLN` (portable POSIX) capped to `min(16, cores-2)`, floored at 1.

## Key Files

| File | Action |
|---|---|
| `scripts/effort/resolve.sh` | New — tier resolver; emits 6 env knobs + model map + audit event |
| `scripts/effort/tests/test-resolve.sh` | New — fixture matrix: precedence × all 4 tiers × knob correctness |
| `.claude/settings.json` | Edit — add `ATHENA_EFFORT: "standard"` beside `AUTOPILOT_THRESHOLD` |
| `CLAUDE.md` | Edit — add "Effort Tiers" contract section + knob table |
| `.claude/commands/athena/batch.md` | Edit — add `--effort <tier>` argument-table row |
| `.claude/commands/athena/qa.md` | Edit — add `--effort <tier>` argument-table row |
| `.claude/commands/athena/autopilot.md` | Edit — add `--effort <tier>` argument-table row |
| `.claude/commands/athena/loop.md` | Edit — add `--effort <tier>` argument-table row |
| `.claude/commands/athena/ship.md` | Edit — add `--effort <tier>` argument-table row |
| `.claude/commands/athena/pr.md` | Edit — add `--effort <tier>` argument-table row |

## Implementation

1. Create `scripts/effort/` directory; author `resolve.sh` — parse `$1` for `--effort <tier>`, fall back to `$ATHENA_EFFORT`, fall back to `standard`; emit the 6 `export` statements + model map as key=value pairs; emit `effort_resolved` JSONL line to `.claude/audit.jsonl`; implement `getconf`-based cores cap for `ultra`
2. Write `scripts/effort/tests/test-resolve.sh` — fixture matrix covering: `--effort quick/standard/thorough/ultra` overrides env; `ATHENA_EFFORT=thorough` without flag; no args → `standard`; verify each knob value per tier; verify `source` field in audit event; assert `standard` output is byte-identical to today's hardcoded values
3. Add `ATHENA_EFFORT: "standard"` to `.claude/settings.json` env block (beside existing `AUTOPILOT_THRESHOLD`)
4. Wire `eval "$(scripts/effort/resolve.sh "$ARGUMENTS")"` into the prologue of `batch.md`, `qa.md`, `autopilot.md`, `loop.md`, `ship.md`, `pr.md`
5. Add `--effort <tier>` row to each command's argument table with description `quick|standard|thorough|ultra — scales fan-out, verification depth, and model tier (default: standard)`
6. Add "Effort Tiers" section to `CLAUDE.md` with the knob table and precedence rule; note that standard is backward-compatible

## Acceptance Criteria

- [ ] `scripts/effort/resolve.sh` emits exactly 6 env knobs (`MAX_CONCURRENT`, `MAX_ITERATIONS`, `REVIEW_LOOP_BUDGET`, `AUTOPILOT_THRESHOLD`, `ATHENA_VERIFY_POSTURE`, model map) for all four tiers
- [ ] `standard` tier output is byte-identical to today's hardcoded values: `MAX_CONCURRENT=4`, `MAX_ITERATIONS=4`, `REVIEW_LOOP_BUDGET=50000`, `AUTOPILOT_THRESHOLD=0.85`
- [ ] Precedence holds: `--effort flag` beats `$ATHENA_EFFORT` env beats `default standard`; `source` field in audit event reflects which level fired
- [ ] `effort_resolved` audit event is emitted to `.claude/audit.jsonl` on every `resolve.sh` invocation, with correct `tier` and `source` fields
- [ ] `ultra` MAX_CONCURRENT uses `getconf _NPROCESSORS_ONLN`, capped at `min(16, cores-2)`, floored at 1
- [ ] `scripts/effort/tests/test-resolve.sh` covers the full precedence × tier matrix and passes in <3s
- [ ] All 6 commands (`batch`, `qa`, `autopilot`, `loop`, `ship`, `pr`) contain `--effort <tier>` in their argument tables and source `resolve.sh` in their prologues
- [ ] Omitting `--effort` and unsetting `$ATHENA_EFFORT` produces identical behavior to today (no regression)

## Alignment / Cross-Epic Hooks

- **Deps E193** — reuses the E193 audit event vocabulary and JSONL schema (`ts/event/+payload`); `effort_resolved` joins the existing event catalog alongside `tier0_loaded`, `rule_fired`, `review_loop`, `verification_check`
- **Unblocks E199+** — downstream ultracode epics (E199 No-Silent-Caps Audit + /metrics --effort, E200 QA Workflow wrapper, E201 batch Workflow) all accept `--effort ultra` as their high-ambition mode; they read the env knobs this resolver exports without needing their own tier logic
- **Reuses existing driver reads** — `reviewer-loop.sh` already reads `MAX_ITERATIONS` (line 34) and `REVIEW_LOOP_BUDGET` (line 35); `autopilot.sh` already reads `AUTOPILOT_THRESHOLD` (line 42); no driver modification required beyond sourcing the resolver

## Out of Scope

- Confidence-derived tier (auto-escalating effort based on QA score) — defer until a real need appears; keep precedence simple at three levels
- Actually wrapping qa/batch in a Workflow API (E200/E201) — those are later epics in Phase 48; this epic only exports the knobs
- Ultra judge panels and multimodal verification implementation — `ATHENA_VERIFY_POSTURE=judge-panel+adversarial+multimodal` is exported as a string; acting on it is deferred to the consuming epic
- Per-command effort-tier overrides (e.g., `batch` ignoring the flag for sub-steps) — uniform resolver output for v1

## Provenance

- Spec source: 2-workflow enhancement audit (athena-enhancement-research + ultracode-into-athena), 2026-05-30
- Approved via `/athena:plan approve E193,E194,E195,E196,E197` on 2026-05-30 (Cycle 21); Phase 48/49 rendered same day under "no limit 5 epics" override
