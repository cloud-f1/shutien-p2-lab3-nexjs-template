# E189 — Memory-Aware Planning (@strategist Reads Tier 0/1 During Brainstorm)

> Phase 46 — Workflow Discipline + Memory-Aware Planning | Size: S (8 SP) | Deps: E187

## Problem

Tier 0 + Tier 1 memory exists but is **passive** — agents *write* lessons during `/athena:promote` but rarely *read* them during design. `@strategist` proposing a new epic doesn't surface "we tried this 3 months ago and it failed because X" lessons. Phase 45 closed the retrieve-loop *mechanically* (E180 retrieval logging, E182 selective inject at SessionStart), but the design-time retrieval gap remains: when brainstorming a feature, no part of the pipeline says "check the memory before proposing".

E187 introduces `/athena:plan brainstorm` as the design-dialogue entry point. E189 wires Tier 0 + Tier 1 retrieval **into that dialogue**, closing the active-memory loop.

## Solution

Extend `@strategist`'s Brainstorm Mode (E187) to read tagged memory at the start of every brainstorm dialogue. Reuse E182's `scripts/memory/match.sh` per-lesson scoring primitive — no new retrieval engine, just a new orchestrator.

**Important — match.sh API reminder (verified 2026-05-19):**

`match.sh` scores **one lesson at a time** against a cue. Its signature is:

```
match.sh <lesson-file> [--paths <stream>] [--tags <stream>]
```

It does **NOT** take a `--context` flag, and it does **NOT** loop over lessons. E182's `inject.sh` is the orchestrator that loops + calls `match.sh` per lesson. E189 follows the same pattern with a brainstorm-specific orchestrator.

### Workflow inside brainstorm

1. User invokes `/athena:plan brainstorm "weekly digest emails for project owners"`
2. **NEW** — `@strategist` extracts keywords from the feature description (simple stopword filter for v1: lowercase, dedupe, drop tokens ≤3 chars; corpus-aware TF-IDF deferred to Phase 48)
3. **NEW** — Calls new orchestrator `scripts/memory/brainstorm-retrieve.sh <keywords-csv>` which:
   - Loops over `~/.claude/template-memory/*.md` (excluding `_archive/`)
   - For each lesson, runs `match.sh <lesson> --tags <keywords-stream>` to compute the score
   - Filters by `score >= 1.0` (a single tag overlap exceeds 2.0 via the `2 * tag_overlap` term; below that, signal is too weak)
   - Cross-filters lesson strength via E181's `score.sh get <lesson>` and drops if `strength < 0.4`
   - Returns top N=5 ranked lessons as JSON: `[{name, score, strength}, ...]`
4. **NEW** — If matches returned, `@strategist` injects each as a design-consideration block: *"Past lesson: when we did Y, we hit Z gotcha — see `[[name]]`. Consider whether this applies."*
5. Continues with existing Brainstorm Mode protocol (Q&A, propose approaches, present design)

**Tier 1** (`docs/context/`) — a separate read step before Tier 0, simpler grep-based: `grep -l <keyword>` on H2 section headings in `qa-patterns.md`, `decisions.md`, `debug-log.md`. No score, just inclusion if any keyword hits any heading. Filters out architecture/test-status/health logs (too generic).

### Audit event extension (schema change)

This epic **extends** the canonical `tier0_loaded` schema (currently `{ts, event, lesson, agent, epic}` per `scripts/hooks/CLAUDE.md` § Memory Retrieval Events E180) with an **optional** `context` field. Backward compat: events without `context` still validate; the field is purely additive.

```json
{"ts":"2026-05-20T10:00:00Z","event":"tier0_loaded","lesson":"anti-patterns.md","agent":"strategist","epic":"E189","context":"brainstorm"}
```

E186 `/athena:metrics --memory` dashboard gains a "Brainstorm context retrievals" slice — count of `tier0_loaded` events with `context=brainstorm` over last 30 days. The other context value emitted today is implicit `null`/absent (means "SessionStart inject" — Block A or Block B).

Schema documentation goes in `scripts/hooks/CLAUDE.md` § Memory Retrieval Events (E180) — add `context` field to the field table with note: "Optional — present on brainstorm retrievals (E189); absent on SessionStart Block A/B injects (E180/E182)."

### Strength reinforcement chain

Lessons cited during brainstorm trigger `score.sh reinforce` (E181 chain) with signal `agent_cited` (+0.15 strength bump). Per-session dedup prevents repeated brainstorms in one session from over-reinforcing.

## Key Files

| File | Action |
|---|---|
| `scripts/memory/brainstorm-retrieve.sh` | New — orchestrator: loops over Tier 0, calls `match.sh` per lesson, ranks + filters |
| `scripts/memory/tests/test-brainstorm-retrieve.sh` | New — 4+ fixtures (no match, single match, multi-match, evergreen-floor, strength-cutoff) |
| `.claude/agents/strategist.md` | Edit — extend Brainstorm Mode section with retrieval step (NEW Step 0 before Step 1: keyword extraction + brainstorm-retrieve.sh + Tier 1 grep + inject as design-consideration block + emit `tier0_loaded {context: "brainstorm"}` per match) |
| `scripts/memory/match.sh` | **No change** — per-lesson scoring primitive used as-is. `--context` flag NOT added (kept minimal); context propagates via the audit emission in the orchestrator. |
| `scripts/memory/score.sh` | No change — `reinforce <lesson> agent_cited` already supported |
| `scripts/hooks/CLAUDE.md` | Edit — extend Memory Retrieval Events (E180) field table with optional `context` field documentation |
| `.claude/commands/athena/metrics.md` | Edit — add "Brainstorm context retrievals" section to `--memory` output (count `tier0_loaded` with `context=brainstorm`) |
| `docs/context/qa-patterns.md` | Edit — note the retrieval-during-design pattern |

## Implementation

1. Author `scripts/memory/brainstorm-retrieve.sh`:
   - Argument: one positional `<keywords-csv>` (e.g. `"digest,emails,owners,weekly"`)
   - Loop over `${TEMPLATE_MEMORY_DIR:-~/.claude/template-memory}/*.md` (skip `_archive/`)
   - For each lesson, build a `\n`-separated tag stream from the CSV, call `match.sh <lesson> --tags <stream>`, capture score
   - Filter `score >= 1.0` AND `score.sh get <lesson>` (E181 strength) `>= 0.4`
   - Output top N=5 as JSON: `[{name, score, strength}, ...]`
   - Test injection envs: `AUDIT_LOG_PATH`, `TEMPLATE_MEMORY_DIR`, `BRAINSTORM_TOP_N` (default 5), `BRAINSTORM_MIN_STRENGTH` (default 0.4)
2. Extend `@strategist` Brainstorm Mode with Step 0:
   - Run keyword extraction (simple stopword filter; tokens longer than 3 chars, lowercase, deduped)
   - Call `brainstorm-retrieve.sh "<keywords-csv>"`; parse JSON output
   - Also run Tier 1 grep: `grep -l -E "$keyword_regex" docs/context/{qa-patterns,decisions,debug-log}.md` (non-fatal if empty)
   - For each returned Tier 0 lesson: emit `tier0_loaded {context: "brainstorm"}` event via `jq -n -c`; chain `score.sh reinforce <lesson> agent_cited`
3. Format injected lessons as design-consideration prefix to the dialogue (one block per lesson)
4. Add "Brainstorm context retrievals" section to `/athena:metrics --memory`: count `tier0_loaded` events filtered to `context=brainstorm`, last 30 days; show top-5 most-retrieved lessons
5. Update `scripts/hooks/CLAUDE.md` § Memory Retrieval Events (E180) field table: add `context` row with note about optional/additive nature
6. Write 4+ fixture tests in `test-brainstorm-retrieve.sh` covering match outcomes (no-match → `[]`; single-match; multi-match ranked; evergreen-floor bypasses min-strength; strength-cutoff drops weak)

## Acceptance Criteria

- [ ] `scripts/memory/brainstorm-retrieve.sh` exists; takes keywords CSV; loops Tier 0; calls `match.sh` per lesson; returns top-5 JSON
- [ ] `@strategist` Brainstorm Mode (E187 protocol) calls `brainstorm-retrieve.sh` before Step 1 dialogue
- [ ] Injects ≥1 relevant Tier 0 lesson when match found (score ≥1.0, strength ≥0.4, evergreen lessons bypass min-strength)
- [ ] Also greps Tier 1 (`qa-patterns.md` / `decisions.md` / `debug-log.md`) for keyword hits in H2 headings
- [ ] No injection when no matches (graceful no-op — dialogue proceeds as if E189 wasn't there)
- [ ] Audit emits `tier0_loaded {context: "brainstorm", lesson, agent: "strategist", epic}` — schema extension documented in `scripts/hooks/CLAUDE.md`
- [ ] Backward compat: existing E180/E182 `tier0_loaded` events without `context` field still parse correctly
- [ ] Tier 0 lessons retrieved during brainstorm have `retrieval_count` and `last_retrieved` updated via `score.sh reinforce` (E181 chain)
- [ ] `/athena:metrics --memory` displays a "Brainstorm context retrievals" section (count + top-5 lessons)
- [ ] 4+ fixture tests pass in `test-brainstorm-retrieve.sh`
- [ ] Brainstorm dialogue runtime adds <500ms vs. baseline (memory retrieval is fast; per-lesson `match.sh` call is <50ms × ~10 lessons)

## Alignment / Cross-Epic Hooks

- **Depends on E187** — brainstorm sub-mode must exist before this can wire retrieval in
- **Reuses E182** — `scripts/memory/match.sh` is the retrieval engine
- **Reuses E180** — `tier0_loaded` event schema (already supports `context` field from E182)
- **Reuses E181** — `score.sh reinforce` chain bumps strength on retrieval
- **Feeds E186** — `/athena:metrics --memory` dashboard gains brainstorm slice
- **Independent of E188, E190** — separate concerns, no shared files

## Out of Scope

- TF-IDF keyword extraction (corpus stats) — simple stopword filter sufficient for v1; revisit Phase 48 if precision is an issue
- Per-keyword weighting (e.g., proper nouns ranked higher) — defer
- Cross-project memory match (Tier 0 from other projects) — Phase 48+; current ~/.claude/template-memory is single-project-scoped
- Embedding-based semantic match — Phase 48+; would require new infra
- Lesson clustering at retrieval time — E190 detects clusters, but doesn't fold into brainstorm yet

## Provenance

- Spec source: `docs/superpowers/specs/2026-05-18-athena-phase-46-roadmap.md` §5 E189
- Approved via `/athena:plan approve E187,E188,E189,E190,E191` on 2026-05-19 (Cycle 20)
