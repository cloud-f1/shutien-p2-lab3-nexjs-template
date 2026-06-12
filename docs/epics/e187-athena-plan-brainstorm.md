# E187 — `/athena:plan brainstorm` Mode + Enriched Epic File Template

> Phase 46 — Workflow Discipline + Memory-Aware Planning | Size: M (13 SP) | Deps: none | **Foundation epic**

## Problem

`/athena:plan` is strategic (proposes which epic to do next) — there is no design-dialogue layer that refines a *specific* feature idea before it is formalized into a spec. Agents currently jump from "idea" to "spec" with no intermediate gate, leading to mid-implementation rework when assumptions turn out wrong.

Existing epic files (`docs/epics/e{n}-*.md`) capture Problem / Stories / AC / Dependencies / Risk but lack tactical content — phases, checkpoints, test strategy. Each epic's implementation plan is implicit in the unstructured "Implementation" section.

## Solution

Two grafts from obra/superpowers, both into existing athena primitives:

1. **`brainstorming` → `/athena:plan brainstorm "X"` sub-mode** — Q&A dialogue with `@strategist` (gains new Brainstorm Mode protocol). Explore context → ask one question at a time (cap 7) → propose 2-3 approaches → present design sections → capture phases/checkpoints/test_strategy.
2. **`writing-plans` → enriched epic file template** — on `/athena:plan approve`, the existing epic-file-creation step writes `docs/epics/e{n}-{slug}.md` with NEW sections (**Implementation Phases**, **Per-Phase Checkpoints**, **Test Strategy**) derived from the brainstorm. **No new doc type, no new directory.**

A harness script `scripts/plan/brainstorm-emit.sh` does deterministic writes (strategy-log row append + epic file render + audit event emit). The slash command markdown drives the LLM dialogue; the harness is unit-testable in isolation.

### Audit event schema (appended to `.claude/audit.jsonl`)

```json
{"ts":"2026-05-19T12:00:00Z","event":"plan_brainstorm","epic":"E300","status":"proposed","phase_count":3}
{"ts":"2026-05-19T13:00:00Z","event":"plan_brainstorm","epic":"E300","status":"approved","phase_count":3}
```

Test injection via `AUDIT_LOG_PATH`, `STRATEGY_LOG_PATH`, `EPICS_DIR`, `CLOCK_DATE`, `CLOCK_TS` env vars (mirrors E180–E184 convention).

## Key Files

| File | Action |
|---|---|
| `scripts/plan/brainstorm-emit.sh` | New — harness: 2 subcommands (`strategy-log`, `render-epic`) + audit emit |
| `scripts/plan/tests/test-brainstorm-emit.sh` | New — 7 fixture tests (usage, golden strategy-log, golden epic file, audit, missing field, idempotency, backward compat) |
| `scripts/plan/tests/fixtures/sample-brainstorm.json` | New — reference JSON input |
| `scripts/plan/tests/golden/expected-strategy-log-row.md` | New — golden output |
| `scripts/plan/tests/golden/expected-epic-file.md` | New — golden output |
| `.claude/commands/athena/plan.md` | Edit — add `brainstorm` to Usage; new Step 2.5; extend Step 1 of approve flow |
| `.claude/agents/strategist.md` | Edit — new `Brainstorm Mode` section with full protocol |
| `scripts/hooks/CLAUDE.md` | Edit — document `plan_brainstorm` event next to E180–E184 schemas |
| `docs/context/qa-patterns.md` | Edit — one-paragraph pattern note |

## Implementation

The full task-by-task plan lives at `docs/superpowers/plans/2026-05-19-e187-athena-plan-brainstorm.md` — 11 tasks, ~700 lines, complete TDD code in every step.

High-level phase outline:

1. **Foundation** (Tasks 1–5) — harness script + 7 fixture tests + golden comparisons + edge cases (missing field, idempotency, back-compat)
2. **Slash command integration** (Tasks 6) — extend `/athena:plan` with `brainstorm` sub-mode + approve dispatch
3. **Agent protocol** (Task 7) — add `Brainstorm Mode` section to `@strategist.md`
4. **Documentation** (Tasks 8–9) — `plan_brainstorm` audit event docs + `qa-patterns.md` note
5. **Verification + commit** (Tasks 10–11) — E2E smoke + full test suite + PR

## Acceptance Criteria

- [ ] `/athena:plan brainstorm "X"` extends the strategy-log row with phases / checkpoints / test_strategy fields
- [ ] On `/athena:plan approve`, the generated `docs/epics/e{n}-{slug}.md` contains: Implementation Phases (≥3), Per-Phase Checkpoints, Test Strategy section
- [ ] Audit log emits `plan_brainstorm` event with `{epic, status, phase_count}` fields (proposed + approved variants)
- [ ] Existing `/athena:plan` modes (audit/research/comply/evolve/auto) work unchanged — `brainstorm` is purely additive
- [ ] `@strategist` agent definition has `Brainstorm Mode` section with full protocol
- [ ] 7 fixture tests pass in `scripts/plan/tests/test-brainstorm-emit.sh`
- [ ] Backward compat: E180–E186 epic files still pass core-section sanity check (Problem + AC)
- [ ] `scripts/hooks/CLAUDE.md` documents `plan_brainstorm` event next to E180–E184 schemas
- [ ] `docs/context/qa-patterns.md` notes the new pattern

## Alignment / Cross-Epic Hooks

- **Foundation for E189** — Memory-aware planning extends `@strategist` brainstorm mode with Tier 0/1 retrieval. E189 cannot ship until E187's brainstorm sub-mode exists.
- **Foundation for E191** — Cycle integration wires `/athena:cycle` entry to `/athena:plan brainstorm`. Sequenced after E187+E188+E189.
- **Independent of E188 + E190** — both ship in Wave 1 in parallel.
- **Reuses E180 audit-log convention** — `plan_brainstorm` joins `tier0_loaded`, `rule_fired`, `agent_cited`, `plan_brainstorm` family.

## Out of Scope

- Visual companion for brainstorm dialogue (browser-based mockup loop) — deferred to Phase 47
- Auto-extracting phases from non-brainstorm modes (audit/research/comply/evolve) — would force a migration of all existing strategy-log rows; not worth the disruption
- Migrating existing E180–E186 epic files to enriched template — backward compat is "additive only"
- TF-IDF keyword extraction for brainstorm idea matching — simple stopword filter sufficient for v1; revisit Phase 48 if precision matters

## Provenance

- Spec source: `docs/superpowers/specs/2026-05-18-athena-phase-46-roadmap.md` §5 E187
- Implementation plan: `docs/superpowers/plans/2026-05-19-e187-athena-plan-brainstorm.md`
- Approved via `/athena:plan approve E187,E188,E189,E190,E191` on 2026-05-19 (Cycle 20)
