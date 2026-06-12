# E197 — Memory Loop Closure

> Phase 47 — Foundation Truth | Size: M (13 SP) | Deps: none

## Problem

The Ebbinghaus memory pipeline shipped across E180–E186 defines four arcs — retrieve, reinforce, decay, and forget — but the audit log shows 3 of 4 arcs have produced zero live events. As of spec authoring (2026-05-30, ~23 days since the last `/athena:save` on 2026-05-07), `~/.claude/template-memory/` lessons `failure-patterns.md`, `integration-gotchas.md`, `testing-patterns.md`, and `performance-insights.md` were frozen at `strength: 0.5`, `retrieval_count: 0`, and `last_retrieved: 2026-05-07`. A single `decay-all` run during the spec session (2026-05-30T05:16Z) moved values to 0.2939 / 0.4188 / 0.4576 / 0.4576 respectively — but without any `last_decayed` write-back, subsequent calls will re-anchor to the original 2026-05-07 date and compound decay incorrectly.

Root cause in `scripts/memory/score.sh` lines 310–334 (`cmd_decay`): the function reads `last_retrieved` as the decay anchor but never writes it back after applying decay. This means elapsed time is computed from the original creation/retrieval date regardless of how many times `decay-all` has run, making decay a function of invocation count rather than wall-clock. Concretely, four `decay-all` calls on the same day produce `S 0.5 → 0.3969` instead of the correct single-day result of `~0.4559`. The second structural failure: `decay-all` is only triggered by the manual `/athena:save` command (see `save.md` line 77), which has not run since 2026-05-07 — so decay is effectively dormant between save checkpoints.

Two additional arcs are broken by implementation gaps. `scripts/memory/consolidation-detect.sh` computes tag-Jaccard similarity from file frontmatter, but 12 of 14 Tier 0 lessons store tags exclusively in the `lesson-tags.json` sidecar (not in frontmatter). Every pair therefore has Jaccard ≈ 0, and all three historical runs have reported `clusters=0` — the consolidation arc has never fired. Separately, a test fixture (`test-lesson.md`, since removed) emitted real events against `~/.claude/template-memory/` and the shared `.claude/audit.jsonl` on 2026-05-19, introducing test pollution into production Tier 0 state; no guard currently prevents recurrence.

## Solution

1. **Fix `cmd_decay` write-back** (`scripts/memory/score.sh` lines 310–334): after computing and persisting the new strength value, write `last_retrieved: <today>` (or introduce a dedicated `last_decayed` frontmatter field) back to the lesson file. This anchors each subsequent decay call to the correct elapsed interval rather than the original retrieval date.

2. **Once-per-day decay guard in SessionStart** (`scripts/hooks/session-start.sh`): read a `.last-decay-ts` stamp file (stored in `~/.claude/template-memory/.last-decay-ts`). If the stamp is absent or older than 24 hours, run `score.sh decay-all` and update the stamp. This makes decay unconditionally time-driven and removes the dependency on a manual `/athena:save`.

3. **Loop-liveness assertion in `metrics.sh`** (`scripts/memory/metrics.sh`): add a Section 8 — "Arc Liveness" — that reads the audit log for each of the four event types (`agent_cited`, `rule_fired`, `strength_decayed`, `lesson_archived`) and flags any arc with zero events in the past 30 days as `STALE`. Surface the same flag in `/athena:metrics --memory` output.

4. **Fix tag resolution in `consolidation-detect.sh`**: replace the inline frontmatter-only tag reader with a call to the same resolver `match.sh` uses — frontmatter first, then fall back to `lesson-tags.json`. This unblocks the consolidation arc for all 12 sidecar-tagged lessons.

5. **Test-isolation guard**: in `score.sh` and `inject.sh`, detect when the target Tier 0 directory is the default `~/.claude/template-memory/` path. If `ALLOW_TIER0_WRITE` is not set to `1`, abort with a non-zero exit and a clear error message. Test fixtures must set `TIER0_DIR` to a temp directory.

## Key Files

| File | Action |
|---|---|
| `scripts/memory/score.sh` | Edit — fix `cmd_decay` write-back (last_retrieved/last_decayed); add `ALLOW_TIER0_WRITE` isolation guard |
| `scripts/hooks/session-start.sh` | Edit — add once-per-day decay-all trigger gated on `.last-decay-ts` stamp |
| `scripts/memory/metrics.sh` | Edit — add Section 8 Arc Liveness (4 event types, 30-day window, STALE flag) |
| `scripts/memory/consolidation-detect.sh` | Edit — replace frontmatter-only tag reader with frontmatter-first + sidecar fallback |
| `scripts/memory/inject.sh` | Edit — add `ALLOW_TIER0_WRITE` isolation guard matching score.sh |
| `scripts/memory/tests/test-score-decay.sh` | New — decay idempotency fixtures (N same-day calls == 1-day decay) |
| `scripts/memory/tests/test-session-decay.sh` | New — stamp-file guard fixtures (fresh stamp skips, stale stamp triggers) |
| `scripts/memory/tests/test-consolidation-sidecar.sh` | New — seeded near-dup pair with sidecar tags → clusters>0 |
| `scripts/memory/tests/test-isolation-guard.sh` | New — real Tier 0 path blocked without flag; temp dir passes |

## Implementation

1. Write fixtures first (`test-score-decay.sh`) — assert that calling `score.sh decay-all` twice on the same day against a temp lesson yields the same strength as calling it once (idempotency proof).
2. Fix `cmd_decay` in `score.sh`: after persisting updated strength, write `last_decayed: $(date -u +%Y-%m-%d)` back to the frontmatter. Update the decay formula to anchor elapsed time to `last_decayed` (prefer over `last_retrieved` if present).
3. Write `test-isolation-guard.sh` fixtures, then add the `ALLOW_TIER0_WRITE` guard to `score.sh` and `inject.sh`.
4. Write `test-session-decay.sh` fixtures, then add the `.last-decay-ts` stamp logic to `session-start.sh` (create/update stamp after successful `decay-all`; skip if stamp age < 86400 seconds).
5. Write `test-consolidation-sidecar.sh` with a seeded near-duplicate pair carrying tags only in `lesson-tags.json`, assert `clusters >= 1`. Then fix `consolidation-detect.sh` tag resolver.
6. Add Section 8 Arc Liveness to `metrics.sh`; assert each of the 4 audit event types is checked and STALE is emitted to stdout when count == 0 in 30-day window.
7. Run all new test fixtures; confirm zero writes to the real `~/.claude/template-memory/` without `ALLOW_TIER0_WRITE=1`.
8. Manually trigger a `decay-all` with the fixed `score.sh` against Tier 0; confirm `failure-patterns.md` strength decreases by the correct single-day increment from its current value (0.2939 as of 2026-05-30) and `last_decayed` is written.

## Acceptance Criteria

- [ ] Calling `score.sh decay-all` N times on the same calendar day against any lesson produces the same strength as calling it once (idempotent; verified by `test-score-decay.sh`)
- [ ] `session-start.sh` runs `decay-all` automatically when `.last-decay-ts` is absent or >24 h old; skips when stamp is fresh (verified by `test-session-decay.sh`)
- [ ] `metrics.sh` Section 8 prints `STALE` for any of the 4 arc event types (`agent_cited`, `rule_fired`, `strength_decayed`, `lesson_archived`) with zero occurrences in the past 30 days in `.claude/audit.jsonl`
- [ ] `consolidation-detect.sh` reports `clusters >= 1` on a seeded near-duplicate lesson pair whose tags live only in `lesson-tags.json` (verified by `test-consolidation-sidecar.sh`)
- [ ] `score.sh` and `inject.sh` both exit non-zero with a clear error when target dir == `~/.claude/template-memory/` and `ALLOW_TIER0_WRITE` is unset; they succeed when `ALLOW_TIER0_WRITE=1` (verified by `test-isolation-guard.sh`)
- [ ] After a real `decay-all` run with the fixed script, `failure-patterns.md` `last_decayed` frontmatter field is present and strength decreases by the correct single-elapsed-day increment from the current value (no compounding from the original 2026-05-07 anchor)
- [ ] All new test scripts run in < 3 s total and write no files outside their designated `$TMP_DIR`
- [ ] `/athena:metrics --memory` output includes Section 8 Arc Liveness with STALE/OK status per arc

## Alignment / Cross-Epic Hooks

- **Independent epic** — no hard deps; ships in Wave 1 of Phase 47 alongside E193–E196, E205 (E204 already merged).
- **Completes E181** (`score.sh` decay + hooks) and **E182** (`inject.sh` isolation) which shipped correct mechanics but left the write-back and isolation gaps described above.
- **Unblocks E183 promotion-follow-through** accuracy: stale decay values inflate apparent lesson strength, suppressing correct weak-flag detection; fixing decay corrects the input signal.
- **Reuses E180 audit-log infrastructure** — Arc Liveness reads the same `.claude/audit.jsonl` JSONL stream; STALE flags follow the established `jq` query pattern used by `/athena:metrics --memory` Sections 1–7.
- **Reuses E186 metrics dashboard** — Section 8 Arc Liveness grafts directly onto `metrics.sh`; no new dashboard scaffolding needed.

## Out of Scope

- Redesigning the strength math or switching decay functions (e.g., power-law vs exponential) — defer
- Reconciling the seed-memory mirror directory with live Tier 0 — separate work item
- Deleting or disabling any currently unfiring mechanics (rule_fired, lesson_archived arcs) — preserve all mechanics; this epic only adds liveness visibility
- Per-lesson override of the 24-hour decay gate cadence — defer; uniform daily default is sufficient for v1
- Retroactively replaying missed decay intervals to back-correct frozen lessons beyond the single manual `decay-all` in step 8 — defer; one corrective run is sufficient to re-anchor

## Provenance

- Spec source: 2-workflow enhancement audit (athena-enhancement-research + ultracode-into-athena), 2026-05-30
- Approved via `/athena:plan approve E193,E194,E195,E196,E197` on 2026-05-30 (Cycle 21); Phase 48/49 rendered same day under "no limit 5 epics" override
