# E191 — Cycle Integration: Wire Brainstorm-First into `/athena:cycle` + Docs

> Phase 46 — Workflow Discipline + Memory-Aware Planning | Size: S (5 SP) | Deps: E187, E188, E189

## Problem

Once E187–E190 ship, the new brainstorm-first workflow exists — but it isn't wired in:

- `/athena:cycle` still calls `/athena:plan auto` as its entry step (instead of `/athena:plan brainstorm`)
- `CLAUDE.md` doesn't mention the new pipeline; future fork users won't know about the brainstorm gate
- `EPIC_INDEX.md` legend doesn't note that Phase 46+ epics carry Implementation Phases / Checkpoints / Test Strategy sections inline
- `/athena:loop` doc references the old pipeline shape

This epic is the **integration closer** — pure refactor/docs work that ties Phase 46 together. Sequenced last in the wave plan to absorb any breakage from E187–E190 and confirm the new pipeline is stable before becoming the default.

## Solution

Five small atomic edits:

1. **`/athena:cycle`** — first step changes from `/athena:plan auto` (audit-driven proposal) to `/athena:plan brainstorm` (dialogue-driven proposal). The user's feature idea becomes the input.
2. **`CLAUDE.md`** — "Slash Commands" + "Active Epic" sections mention `/athena:plan brainstorm`. "Memory System" section mentions memory-aware brainstorm retrieval (E189).
3. **`EPIC_INDEX.md`** — legend updated to note that Phase 46+ epics include Implementation Phases / Checkpoints / Test Strategy sections inline (no new column needed; the convention shows up inside each epic file).
4. **`/athena:loop`** — doc updates only (no behavior change) — first step description now mentions brainstorm output as the spec source.
5. **Promotion proposal candidate** — write `docs/context/promotion-proposals/2026-XX-XX-brainstorm-first.md` (Tier 0 candidate, `[GENERALIZABLE]`): "brainstorm-first plan workflow" — for future cross-project propagation.

No new code. No new commands. Pure wiring.

## Key Files

| File | Action |
|---|---|
| `.claude/commands/athena/cycle.md` | Edit — first step now invokes `/athena:plan brainstorm` |
| `CLAUDE.md` | Edit — "Slash Commands" + "Active Epic" + "Memory System" sections |
| `docs/epics/EPIC_INDEX.md` | Edit — legend note on enriched Phase 46+ epic format |
| `.claude/commands/athena/loop.md` | Edit — doc clarity only (no behavior change) |
| `docs/context/promotion-proposals/2026-XX-XX-brainstorm-first.md` | New — Tier 0 candidate |
| `docs/context/session-summary.md` | Edit — Phase 46 closeout entry |

## Implementation

1. Verify all of E187/E188/E189 merged and passing (`grep -E "E187|E188|E189" docs/context/epic-progress.md | grep -v "✅ ✅ ✅ ✅ ✅"` should return empty)
2. Edit `cycle.md` — replace `/athena:plan auto` reference in first step with `/athena:plan brainstorm "<feature description>"`
3. Update `CLAUDE.md` three sections (add `/athena:plan brainstorm` to Slash Commands table; mention brainstorm gate in Active Epic notes; mention memory-aware design retrieval in Memory System)
4. Update `EPIC_INDEX.md` legend (one-line note above the Epic Step Matrix header)
5. Update `/athena:loop` doc (Step 1 description mentions brainstorm as upstream)
6. Author `docs/context/promotion-proposals/2026-XX-XX-brainstorm-first.md` — tags `[workflow, planning, dialogue, GENERALIZABLE]`, recommends the pattern for promotion to Tier 0 after a few weeks of use
7. Update `docs/context/session-summary.md` with Phase 46 closeout entry
8. Run full regression: `cd server && uv run pytest -q && cd ../client && pnpm test --run`; expect zero new failures

## Acceptance Criteria

- [ ] `/athena:cycle` first step invokes `/athena:plan brainstorm` (not `/athena:plan auto`)
- [ ] `CLAUDE.md` "Slash Commands" table mentions `/athena:plan brainstorm`
- [ ] `CLAUDE.md` "Memory System" section mentions memory-aware brainstorm retrieval
- [ ] `EPIC_INDEX.md` legend notes enriched Phase 46+ epic format
- [ ] `/athena:loop` Step 1 doc references brainstorm output as spec source (no behavior change)
- [ ] `docs/context/promotion-proposals/2026-XX-XX-brainstorm-first.md` exists, marked `[GENERALIZABLE]`
- [ ] `docs/context/session-summary.md` has Phase 46 closeout entry
- [ ] All hooks pass (no regressions)
- [ ] Full test suite green: server ≥398, client ≥515
- [ ] No new Stop Verifier violations

## Alignment / Cross-Epic Hooks

- **Depends on E187 + E188 + E189** — brainstorm sub-mode + verification skill + memory-aware retrieval must all exist before this wires them together
- **Independent of E190** — consolidation detector is a separate maintenance flow; cycle integration touches only the planning pipeline
- **Final epic of Phase 46** — closeout commit also updates `docs/context/session-summary.md` with phase summary (mirrors Phase 45 close)
- **Promotion proposal** seeds a future `/athena:promote --apply` to Tier 0 — the brainstorm-first pattern becomes cross-project wisdom after 30+ days of use

## Out of Scope

- Behavioral changes to `/athena:loop`, `/athena:batch`, `/athena:ship`, `/athena:pr` — all preserved byte-identical
- Migrating existing E1–E186 epic files to enriched template — backward compat is "additive only"
- Removing `/athena:plan auto` mode — preserved for non-brainstorm use cases (audit/research/comply/evolve cycles)
- New audit events — E191 is pure refactor/docs; no new `.claude/audit.jsonl` event types

## Provenance

- Spec source: `docs/superpowers/specs/2026-05-18-athena-phase-46-roadmap.md` §5 E191
- Approved via `/athena:plan approve E187,E188,E189,E190,E191` on 2026-05-19 (Cycle 20)
