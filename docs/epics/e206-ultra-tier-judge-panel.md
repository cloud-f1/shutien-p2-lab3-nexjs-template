# E206 — Ultra-Tier Judge Panel (E200.1: double-evaluator + spec-judge)

> Phase 50 — Operationalize the Dial | Size: L (18 SP) | Deps: none (builds on shipped E198 + E200)

## Problem

The effort dial's most expensive setting is a no-op above `thorough`. `scripts/effort/resolve.sh` resolves the `ultra` tier to `ATHENA_VERIFY_POSTURE="judge-panel+adversarial+multimodal"` (resolve.sh line 122 sets `ATHENA_MODEL_MAP="reviewer=opus,evaluator=opus"` for ultra), but `scripts/qa/verify-panel.sh` line 66 branches `thorough|ultra)` into a **single** code path — the thorough-tier 4-lens panel + N=3 adversarial refute + single completeness critic. There is no judge-panel, no double-evaluator (two independent contexts that must agree), and no spec-judge. Selecting `--effort ultra` therefore silently delivers `thorough`-quality verification while charging ultra latency and (per the opus model map) ultra token cost.

This is the deferred **E200.1** item ("ultra posture double-evaluator + judge-panel-on-spec") that E200 explicitly cut to ship the POC. It is the single highest-leverage "operationalize the dial" gap: the dial advertises four tiers but only delivers three distinct verification behaviors. This is the same *promise-vs-delivery* failure class that Cycle 21's Foundation Truth phase was built to kill (E204 fail-open gate, E197 dormant decay arc) — a guard/feature that "fails quiet."

The E200 infrastructure that makes the fix tractable is already in place: `scripts/qa/findings-schema.json` (schema-forced verdicts), `run_claude_structured()` in verify-panel.sh (accepts a per-call `model` arg, defaults `claude-sonnet-4-6`), the `verify_panel_start`/`verify_panel_result` audit events, and the proven `claude -p --output-format json --json-schema` IPC substrate (E200 spike, CLI 2.1.159).

## Solution

Add an `ultra` branch to `verify-panel.sh` that runs *after* the existing thorough panel produces its surviving findings, gated on `ATHENA_VERIFY_POSTURE` matching `judge-panel*` (the ultra posture string). The thorough path stays byte-identical; ultra is strictly additive on top of it.

### 1. Double-evaluator (independent-context agreement)

Run **two** independent `@evaluator`-style passes against the same diff + epic spec, each in a *fresh* `claude -p` context (no shared state), each emitting a schema-forced verdict (`PASS|FAIL|STUCK` + findings). Both must independently reach `PASS` for the epic to advance:

- **Agree on PASS** → verdict `PASS`.
- **Agree on FAIL** → verdict `FAIL` (surface the union of both evaluators' open findings).
- **Disagree** → verdict `ESCALATE` (do NOT auto-advance; emit a `needs_human` signal with both verdicts + their reasoning). Disagreement is information, not noise.

Use opus for both evaluators per the ultra model map.

### 2. Judge-panel on spec (completeness, multi-judge)

Replace the single completeness critic with an **N=3 judge panel**, each judge asked a distinct question against the epic's acceptance criteria:
- Judge A (coverage): "Which AC has no cited `file:line` in the evidence?"
- Judge B (correctness): "Does any cited evidence actually fail to satisfy the AC it claims?"
- Judge C (regression): "Does any change plausibly break an untested adjacent behavior?"

Any AC flagged `open` by ≥2 of 3 judges is a blocking finding. Single-judge flags are advisory (logged, non-blocking).

### 3. Audit + schema

- New verdict enum value `ESCALATE` added to `findings-schema.json` (additive — existing `PASS|FAIL|STUCK` unchanged).
- Emit `verify_panel_ultra` audit event: `{event, epic, evaluator_a_verdict, evaluator_b_verdict, agreed, judge_open_count, final_verdict}`.

## Key Files

| File | Action |
|---|---|
| `scripts/qa/verify-panel.sh` | Edit — add `ultra`-gated double-evaluator + judge-panel section after the thorough panel; keep thorough path byte-identical |
| `scripts/qa/findings-schema.json` | Edit — add `ESCALATE` to the `verdict` enum (additive) |
| `scripts/qa/tests/test-verify-panel.sh` | Edit — add ultra fixtures (agree→PASS, agree→FAIL, disagree→ESCALATE, judge ≥2/3 open→blocking) via `CLAUDE_CMD` mock |
| `.claude/commands/athena/qa.md` | Edit — document the ultra posture behavior in the posture-routing table |
| `scripts/hooks/CLAUDE.md` | Edit — add `verify_panel_ultra` event schema |

## Implementation

1. Read `verify-panel.sh` in full; confirm the thorough panel produces a collected `surviving findings` structure the ultra section can consume.
2. Write ultra fixtures FIRST (TDD) in `test-verify-panel.sh` using `CLAUDE_CMD` mock: two-evaluator agreement matrix (PASS/PASS, FAIL/FAIL, PASS/FAIL→ESCALATE) + judge-panel majority (2/3 open → blocking, 1/3 → advisory). These fail against the current single-path code (RED).
3. Add the `ultra` branch in verify-panel.sh, gated on `[[ "$POSTURE" == judge-panel* ]]`, running after the thorough panel. Two `run_claude_structured` evaluator calls (opus) in independent invocations; compare verdicts; on disagreement set `final_verdict=ESCALATE` and do not advance.
4. Add the N=3 judge panel (opus) against the epic AC list; aggregate ≥2/3-open as blocking.
5. Add `ESCALATE` to findings-schema.json enum; emit `verify_panel_ultra`.
6. Run the suite (GREEN); confirm thorough-path fixtures are unchanged (no regression — diff the thorough fixture outputs).
7. POC gate: run the ultra panel once against a real epic diff (e.g. a deliberately under-evidenced change) and confirm the double-evaluator escalates rather than rubber-stamps.

## Acceptance Criteria

- [ ] `ATHENA_VERIFY_POSTURE=judge-panel+adversarial+multimodal` (ultra) runs the double-evaluator + judge-panel; `thorough` posture is byte-identical to pre-E206 (diff the thorough fixture outputs — zero delta)
- [ ] Two independent-context evaluators both run (separate `claude -p` invocations, opus model); both must PASS for advance
- [ ] Evaluator disagreement (one PASS, one FAIL) produces `ESCALATE` — the epic does NOT auto-advance; a `needs_human` signal carries both verdicts
- [ ] The N=3 judge panel flags any AC as blocking when ≥2/3 judges mark it `open`; single-judge flags are advisory only
- [ ] `findings-schema.json` `verdict` enum includes `ESCALATE` (additive; existing values unchanged)
- [ ] `verify_panel_ultra` audit event is emitted with both evaluator verdicts, agreement flag, judge open-count, and final verdict
- [ ] `scripts/qa/tests/test-verify-panel.sh` covers the full ultra matrix (agree-PASS, agree-FAIL, disagree-ESCALATE, judge majority) via `CLAUDE_CMD` mock; all pass in <15s with no real API calls
- [ ] `qa.md` posture-routing table documents ultra = judge-panel + double-evaluator (no longer "deferred to follow-up")

## Alignment / Cross-Epic Hooks

- **Builds on E200** (shipped) — reuses `verify-panel.sh`, `findings-schema.json`, `run_claude_structured()` (per-call model arg), and the `claude -p --json-schema` substrate the E200 spike de-risked.
- **Builds on E198** (shipped) — consumes the `ultra` `ATHENA_VERIFY_POSTURE` + opus model map already exported by `resolve.sh`.
- **Closes the Phase 48 loop** with E207 — E206 makes ultra *deliver*, E207 makes its cost *visible*.
- **Reuses E180 audit infra** — `verify_panel_ultra` follows the established `jq -n -c` JSONL pattern.

## Out of Scope

- Multimodal verification (the literal `+multimodal` posture suffix) — there is no image/screenshot input surface in the QA path; the suffix stays a forward-looking label, not implemented here.
- Streaming `claude -p` output — batch only, per the E200 deferral.
- Applying the judge panel to non-QA commands (`/athena:plan`, `/athena:design`) — QA-only for v1.
- Per-judge model tiering beyond the ultra opus default — uniform opus for ultra judges is sufficient for v1.

## Provenance

- Spec source: `/athena:plan auto` Cycle 22 (2026-06-02) — the #1 "operationalize the dial" finding; the deferred E200.1 made concrete.
- Approved via `/athena:plan approve E206,E207,E208,E209,E210` on 2026-06-02 (Cycle 22).
