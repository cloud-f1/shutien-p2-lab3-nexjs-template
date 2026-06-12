# E196 — State-File Truth (render EPIC_INDEX from epic-progress)

> Phase 47 — Foundation Truth | Size: M (8 SP) | Deps: none

## Problem

`docs/epics/EPIC_INDEX.md` and `docs/context/epic-progress.md` have silently diverged. EPIC_INDEX.md lines 32-33 mark Phase 43 as "🔄 In-Progress" and Phase 44 as "⬜ Pending", and its Epic Step Matrix shows E156-E160 commit/merge columns as 🔄/⬜. But epic-progress.md — the file `/athena:loop` reads as authoritative — records Phase 43/44 ✅ Complete and each of E156-E160 with all five pipeline steps ✅✅✅✅✅ plus PR numbers. The human-visible catalog is months behind the machine state file.

The root cause is architectural: EPIC_INDEX.md is a hand-edited document, not a rendered view. The "update BOTH files" rule lived only as prose in `loop.md` and `batch.md`; nothing mechanically enforces it or detects divergence. A Phase completes, epic-progress.md is updated by the orchestrator, and EPIC_INDEX.md drifts silently because no hook diffs the two.

A separate bug exists in `scripts/archive-context.sh`: it determines when to archive by counting H2 headings (per-file limit in the `LIMIT_VALUES` array; `orchestration-log.md` has a limit of 50). But `docs/context/orchestration-log.md` uses 27 H3 entries under only 2 H2 headers. The script sees 2 entries, never triggers the archive threshold, and the log grows unbounded. Any H3-structured context file has the same vulnerability.

## Solution

1. **`scripts/state/render-index.sh`** — reads epic-progress.md as the single source of truth and regenerates the Phase Status table and Epic Step Matrix sections of EPIC_INDEX.md in-place. Prose sections (Dependency Rules, Phase Parallelism) are extracted verbatim and reinjected — they are not regenerated. Running the script is idempotent; repeated invocations produce the same output. The orchestrator (`/athena:loop`, `/athena:batch`) calls this after every epic step update.

2. **`scripts/state/check-drift.sh`** — diffs the Phase Status table and Epic Step Matrix between EPIC_INDEX.md and the values derivable from epic-progress.md. On any per-epic cell mismatch it emits a `state_drift` audit event to `.claude/audit.jsonl` and exits non-zero. Wired into the Stop hook and pre-merge gate in `.claude/settings.json`.

3. **Reconcile current drift** — run render-index.sh once to correct Phase 43/44 headers and E156-E160 columns so EPIC_INDEX.md reflects reality immediately.

4. **Fix `scripts/archive-context.sh`** — replace the H2-only heading count with a per-file configurable depth: detect whether the file uses H2 or H3 as its entry heading and count that depth. Add a fixture covering an H3-structured file so the regression cannot recur.

### Audit event schema (emitted by check-drift.sh)

```json
{"ts":"2026-05-30T00:00:00Z","event":"state_drift","source":"check-drift.sh","mismatches":3,"epic":"E156","expected":"✅","found":"🔄"}
```

## Key Files

| File | Action |
|---|---|
| `scripts/state/render-index.sh` | New — regenerate Phase Status + Epic Step Matrix from epic-progress.md |
| `scripts/state/check-drift.sh` | New — diff detector; emits `state_drift` + exit 1 on mismatch |
| `scripts/state/tests/test-render-index.sh` | New — fixture: round-trip render produces expected cells |
| `scripts/state/tests/test-check-drift.sh` | New — fixture: seeded mismatch triggers exit 1 + audit event |
| `scripts/archive-context.sh` | Edit — count entry-heading depth per file (H2 or H3), not always H2 |
| `scripts/archive-context-tests/test-h3-fixture.sh` | New — H3-structured fixture must archive at threshold |
| `.claude/settings.json` | Edit — wire check-drift.sh into Stop hook + pre-merge hook |
| `docs/epics/EPIC_INDEX.md` | Regenerated — Phase 43/44 + E156-E160 reconciled to match epic-progress.md |

## Implementation

1. Read epic-progress.md format; document the canonical cell encoding (✅ / 🔄 / ⬜ / PR#nnn)
2. Write `render-index.sh` — parse epic-progress.md, produce Phase Status rows and Epic Step Matrix rows, splice into EPIC_INDEX.md between sentinel comments (add sentinels if absent); preserve all prose outside the generated sections
3. Write `test-render-index.sh` — fixture with a minimal epic-progress.md snapshot; assert the rendered Phase Status and matrix cells match expected values byte-for-byte
4. Run render-index.sh against the live repo to reconcile Phase 43/44 + E156-E160 drift; commit the corrected EPIC_INDEX.md
5. Write `check-drift.sh` — re-render to a temp file, diff status cells, collect mismatches, emit `state_drift` JSONL for each, exit 1 if any mismatch
6. Write `test-check-drift.sh` — seed a deliberate mismatch; assert exit 1 and `state_drift` event in audit log
7. Fix `archive-context.sh` heading-depth detection; add `test-h3-fixture.sh`
8. Wire check-drift.sh into `.claude/settings.json` Stop hook; confirm it also runs in pre-merge
9. Update `scripts/hooks/CLAUDE.md` to document `state_drift` event and the two new scripts

## Acceptance Criteria

- [ ] `render-index.sh` reproduces EPIC_INDEX.md Phase Status table and Epic Step Matrix from epic-progress.md with byte-identical status cells; prose sections (Dependency Rules, Phase Parallelism) are preserved unchanged
- [ ] After running render-index.sh, Phase 43/44 headers show ✅ Complete and E156-E160 commit/merge columns show ✅ — matching epic-progress.md
- [ ] `check-drift.sh` exits non-zero and emits at least one `state_drift` JSONL event when a seeded per-epic cell mismatch is present
- [ ] `check-drift.sh` exits 0 and emits no `state_drift` events when EPIC_INDEX.md matches epic-progress.md
- [ ] `test-render-index.sh` and `test-check-drift.sh` pass in <3s each with no external dependencies
- [ ] `archive-context.sh` correctly archives an H3-structured fixture file once its H3 entry count exceeds the configured per-file `LIMIT_VALUES` threshold; the existing H2 behaviour is unchanged
- [ ] check-drift.sh is wired into the Stop hook in `.claude/settings.json` and fires on task completion
- [ ] `render-index.sh` is idempotent: running it twice on the same epic-progress.md produces identical EPIC_INDEX.md output

## Alignment / Cross-Epic Hooks

- **Independent epic** — no deps on other Phase 47 epics; ships first in Wave 1 to unblock accurate EPIC_INDEX reads by subsequent epics
- **Unblocks E197+**: any epic that relies on EPIC_INDEX.md for phase-gate decisions now reads accurate data
- **Reuses E180 audit-log infrastructure** — `state_drift` event follows the established `{ts, event, +payload}` schema, same `jq -n -c` emit pattern as `tier0_loaded` / `rule_fired`
- **Feeds `/athena:dashboard`** — the dashboard's phase progress view reads EPIC_INDEX.md; a rendered view means the dashboard is always accurate

## Out of Scope

- Making epic-progress.md itself generated (it remains the hand-updated source of truth written by loop/batch)
- Collapsing or archiving dead per-agent context logs (separate hygiene item)
- Backfilling render-index.sh calls into historical commits (only future loop/batch invocations call it)
- Auto-correcting drift instead of blocking — check-drift.sh detects and reports only; the fix path is to run render-index.sh

## Provenance

- Spec source: 2-workflow enhancement audit (athena-enhancement-research + ultracode-into-athena), 2026-05-30
- Approved via `/athena:plan approve E193,E194,E195,E196,E197` on 2026-05-30 (Cycle 21); Phase 48/49 rendered same day under "no limit 5 epics" override
