# E200 — Workflow-native /athena:qa Verification Panel (POC)

> Phase 48 — Ultracode Orchestration | Size: L (18 SP) | Deps: E198

## Problem

The current `/athena:qa` pipeline runs `@reviewer`, `@qa`, and `@evaluator` as three **sequential** phases over a single diff. The reviewer round is orchestrated by `scripts/reviewer-loop.sh`, which communicates via markdown write-back: it parses `## Round N` headings, counts `- [ ]` unchecked items, and detects STUCK via a `sha256` of sorted markdown lines. This text-based IPC is brittle — whitespace changes, heading reformats, or list reordering silently corrupt the diff signal and can cause a genuine STUCK state to go undetected or a resolved state to re-trigger.

The `@reviewer → @debugger` handoff has no independent refutation step. A single reviewer emitting a "security finding" drives a full `@debugger` cycle even if the finding is a false positive (e.g., a correctly-scoped auth check misread as missing). There is no adversarial check between the finding and the handoff. Similarly, `@evaluator` runs as a single judge that can rationalize a `🟡` into a `✅` — there is no completeness critic asking "which acceptance criterion has no cited `file:line`?"

Finally, `grep` across `.claude/` and `scripts/` today returns **zero hits** for `json-schema`, `--output-format json`, or `claude -p` — the headless structured-output IPC needed to fix the above is entirely net-new infrastructure. This creates a non-trivial integration risk that must be validated before committing to an 18 SP build.

## Solution

Replace the markdown-IPC reviewer loop at `thorough+` posture with `scripts/qa/verify-panel.sh`, a headless-Claude wrapper using `claude -p --output-format json --json-schema`. The standard/quick paths are **kept byte-identical** to today — `reviewer-loop.sh` is untouched and remains the default.

### Posture routing (`.claude/commands/athena/qa.md` dispatch logic)

| `$ATHENA_VERIFY_POSTURE` | Path |
|---|---|
| `quick` / `standard` (or unset) | `reviewer-loop.sh` — unchanged |
| `thorough` | `verify-panel.sh` — 4-lens panel + refute + completeness critic |
| `ultra` | `verify-panel.sh` + double-evaluator (deferred to follow-up) |

### SPIKE (Day 1, gates everything)

Run a 1-day spike to confirm `claude -p --output-format json --json-schema` is viable as IPC in the current CLI version. Produce `docs/context/e200-spike-report.md` with: CLI version, round-trip latency for a minimal schema, retry behavior on schema mismatch, and a go/no-go verdict. The full build only proceeds if the spike returns **go**.

### verify-panel.sh — thorough tier behavior

1. **4-lens parallel panel** — correctness / security / perf / repro lenses run concurrently, each via `claude -p --output-format json --json-schema scripts/qa/findings-schema.json`. Each emits `{verdict, findings:[{id,severity,open,evidence}]}`. Model tier per E198: lenses on `sonnet`/`haiku`, synthesis on `opus`.
2. **STUCK detection** — structured diff of typed `findings` arrays (replaces `sha256` of sorted markdown). A round is STUCK iff the set of `{id, open}` pairs is identical to the prior round.
3. **Adversarial refute (N=3)** — each `open: true` finding is sent to N=3 independent skeptic prompts instructed to **refute** the finding. Majority-refute (≥2/3) drops the finding before `@debugger` sees it.
4. **Completeness critic** — `@evaluator` gains a second prompt: "Which acceptance criterion in the epic spec has no cited `file:line` in the evidence?" Any uncovered AC is flagged as `open`.

### findings-schema.json (abbreviated)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["verdict", "findings"],
  "properties": {
    "verdict": { "enum": ["PASS", "FAIL", "STUCK"] },
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "severity", "open", "evidence"],
        "properties": {
          "id":       { "type": "string" },
          "severity": { "enum": ["critical","high","medium","low","info"] },
          "open":     { "type": "boolean" },
          "evidence": { "type": "string" }
        }
      }
    }
  }
}
```

## Key Files

| File | Action |
|---|---|
| `scripts/qa/verify-panel.sh` | New — headless-Claude panel orchestrator (thorough tier) |
| `scripts/qa/findings-schema.json` | New — JSON Schema for structured verdict IPC |
| `.claude/commands/athena/qa.md` | Edit — Dispatch Logic adds posture branch reading `$ATHENA_VERIFY_POSTURE` |
| `scripts/reviewer-loop.sh` | No change — kept byte-identical as standard/quick path |
| `scripts/qa/tests/` | New — fixture tests for panel, refute, schema validation |
| `docs/context/e200-spike-report.md` | New — spike go/no-go report (Day 1 artifact) |

## Implementation

1. **SPIKE** — invoke `claude -p --output-format json --json-schema` with a minimal one-field schema; measure latency, retry behavior on mismatch, and CLI version compatibility. Write `docs/context/e200-spike-report.md`. Go/no-go gate.
2. **Author `findings-schema.json`** — full schema with `verdict` enum + `findings` array + required fields. Add `$schema` declaration.
3. **Author `verify-panel.sh`** — skeleton with posture guard (`[[ $ATHENA_VERIFY_POSTURE == thorough ]]`), 4-lens parallel dispatch, `wait` + result collection, schema validation loop (retry on mismatch, max 3 attempts), STUCK detection via `findings` set diff, adversarial refute loop (N=3 per open finding, majority-drop), completeness-critic call.
4. **Write fixture tests in `scripts/qa/tests/`** — at minimum: schema-valid round-trip, STUCK detection (identical finding sets), majority-refute drop (2/3 refute), completeness-critic flagging (AC with no file:line), model-tier assignment (lens vs synthesis), standard-path passthrough (posture=standard → reviewer-loop.sh path taken, verify-panel.sh not called).
5. **Edit `qa.md` dispatch logic** — add posture branch: read `$ATHENA_VERIFY_POSTURE`; route to `verify-panel.sh` at thorough; keep existing path at standard/quick/unset.
6. **POC gate** — run the panel against one auth or billing epic diff; confirm at least one demonstrable false-positive finding is killed by the refute panel. Record result in `docs/context/e200-spike-report.md`.
7. **Emit audit events** — `verify_panel_start`, `verify_panel_result` (verdict + refuted_count + lens_count) to `.claude/audit.jsonl` following E180 schema pattern.
8. Update `docs/epics/EPIC_INDEX.md` status to `done`.

## Acceptance Criteria

- [ ] Spike report `docs/context/e200-spike-report.md` exists with CLI version, latency measurement, retry behavior, and explicit go/no-go verdict
- [ ] `standard` and `quick` postures produce **byte-identical** output to the pre-E200 `reviewer-loop.sh` path (diff produces no delta)
- [ ] `thorough` posture runs 4 lenses concurrently and emits schema-valid `{verdict, findings}` JSON; schema mismatch triggers retry (max 3 attempts) before hard-fail
- [ ] STUCK detection uses `{id, open}` set equality on typed findings arrays — no `sha256`/markdown parsing in the thorough path
- [ ] At least one demonstrable false-positive finding is dropped by the N=3 refute panel on a real auth or billing epic diff (POC gate)
- [ ] Completeness critic flags any acceptance criterion with no `file:line` citation in evaluator evidence
- [ ] Model tiering honored: lenses invoke `sonnet`/`haiku` tier; synthesis/judge invokes `opus` tier (verifiable via audit log `model` field)
- [ ] `scripts/qa/tests/` fixtures cover: schema round-trip, STUCK detection, majority-refute drop, completeness-critic flag, standard-path passthrough — all pass in <10s
- [ ] Audit events `verify_panel_start` and `verify_panel_result` written to `.claude/audit.jsonl` with `refuted_count` and `lens_count` fields

## Alignment / Cross-Epic Hooks

- **Deps**: E198 (`$ATHENA_VERIFY_POSTURE` resolve.sh + model-tier config) must be merged before verify-panel.sh can read posture or route model tier.
- **Unblocks**: E201 (Workflow-native `/athena:batch` conversion) — E200 proves the headless `json-schema` IPC pattern that E201 will reuse for parallel epic orchestration.
- **Reuses**: E180 audit-log infrastructure (`ts/event/+payload` JSONL schema, `jq -n -c` emit pattern); E162 `reviewer-loop.sh` round-state machine (kept intact as standard path).
- **First Workflow-native command POC** — validates the depth-B embedding (`claude -p --output-format json --json-schema substrate`) as viable for the entire Phase 48/49 v2 thesis before committing further epics to it.

## Out of Scope

- `ultra` posture double-evaluator (independent contexts must agree) and judge-panel-on-spec — defer to E200.1 follow-up
- Converting `/athena:batch` to the panel pattern — E201
- Per-lens timeout configuration and partial-result fallback — defer; fixed 120s timeout sufficient for POC
- Streaming output from `claude -p` (currently batch; streaming deferred until schema-over-stream is stable in CLI)
- Backfilling historical `reviewer-loop.sh` runs with structured findings — out of scope; forward-only

## Provenance

- Spec source: 2-workflow enhancement audit (athena-enhancement-research + ultracode-into-athena), 2026-05-30
- Approved via `/athena:plan approve E193,E194,E195,E196,E197` on 2026-05-30 (Cycle 21); Phase 48/49 rendered same day under "no limit 5 epics" override
