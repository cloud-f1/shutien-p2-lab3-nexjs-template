# E190 — Lesson Consolidation Detector

> Phase 46 — Workflow Discipline + Memory-Aware Planning | Size: S (8 SP) | Deps: none

## Problem

Tier 0 has 8 lessons today (and growing). As `/athena:promote` accumulates lessons over many phases, **duplicates and near-duplicates will sneak in** — different wording for the same insight, or lessons that started distinct but converged as they evolved.

`/athena:forget` (E184) archives *weak* lessons (strength below threshold) but does NOT detect *duplicates*. There is no anti-duplication brake. Without one, Tier 0 grows monotonically over time, dilutes selective-inject signal-to-noise (E182), and forces `@memory-curator` to mentally cross-reference every new promotion candidate.

## Solution

Read-only detector. New script `scripts/memory/consolidation-detect.sh`:

1. Loads all Tier 0 lessons (`~/.claude/template-memory/*.md` excluding `_archive/`)
2. Extracts tags + title + first paragraph from each
3. Computes pairwise theme-overlap:
   - **Jaccard on tags** — `|A.tags ∩ B.tags| / |A.tags ∪ B.tags|`
   - **Cosine on first-paragraph token bags** — bag-of-words on first paragraph after frontmatter (stopwords filtered, tokens lowercased, stemmed by simple suffix-strip)
   - **Combined score** — `0.5 * jaccard + 0.5 * cosine`
4. Outputs JSON list of clusters with combined ≥ 0.7
5. **No auto-merge.** Output flows to `/athena:learn` Step 4.6, which writes a markdown surface to `docs/context/promotion-proposals/consolidation-YYYY-MM-DD.md`. Human reviews → merge, dismiss, split, or archive-one.

### Output schema

```json
[
  {
    "cluster_id": "c1",
    "lessons": [
      {"name": "architecture-patterns.md", "score": 0.78},
      {"name": "architecture-lessons.md", "score": 0.78}
    ],
    "avg_overlap": 0.78,
    "detected_at": "2026-05-21T12:00:00Z"
  }
]
```

### Audit event

```json
{"ts":"2026-05-21T12:00:00Z","event":"consolidation_detected","clusters":2,"lessons_involved":5,"epic":"E190"}
```

## Key Files

| File | Action |
|---|---|
| `scripts/memory/consolidation-detect.sh` | New — read-only detector (target <200 lines) |
| `scripts/memory/tests/test-consolidation.sh` | New — 5+ fixtures: empty memory, all-distinct, exact duplicate, near-duplicate, three-way cluster |
| `.claude/commands/athena/learn.md` | Edit — add Step 4.6 (calls detector, surfaces clusters to promotion-proposals/) |
| `docs/context/promotion-proposals/.gitkeep` | Add if missing |
| `.claude/agents/memory-curator.md` | Edit — mention consolidation as input signal |
| `scripts/hooks/CLAUDE.md` | Edit — document `consolidation_detected` audit event |

## Implementation

1. Author `consolidation-detect.sh`:
   - Reads `${TEMPLATE_MEMORY_DIR:-~/.claude/template-memory}/*.md`, excludes `_archive/`
   - For each file: extracts YAML frontmatter `tags:` + first paragraph after frontmatter
   - Pairwise loop: compute Jaccard(tags) + cosine(tokens), combine 50/50
   - If combined ≥ `${CONSOLIDATION_THRESHOLD:-0.7}`, add to cluster
   - Group transitively closed clusters (lessons A↔B↔C → one cluster of 3)
   - Output JSON to stdout
   - Emit `consolidation_detected` audit event with cluster count + total lessons involved
2. Author 5 fixture tests:
   - **Empty memory** (no .md files) → output `[]`
   - **All distinct** (current 8 Tier 0 lessons) → output `[]` (zero false positives)
   - **Exact duplicate** (synthetic pair with identical content) → 1 cluster of 2
   - **Near duplicate** (paraphrased pair, score ~0.75) → 1 cluster of 2
   - **Three-way cluster** (A↔B 0.8, B↔C 0.75, A↔C 0.7) → 1 cluster of 3 (transitive)
3. Add `/athena:learn` Step 4.6:
   - Run `consolidation-detect.sh`, parse output
   - If clusters > 0, write `docs/context/promotion-proposals/consolidation-YYYY-MM-DD.md` with cluster summary + per-lesson links
   - Print one-line summary to user
4. Update `@memory-curator` agent prompt to read consolidation proposals during `/athena:promote`

## Acceptance Criteria

- [ ] `scripts/memory/consolidation-detect.sh` produces well-formed JSON: `[{cluster_id, lessons: [{name, score}], avg_overlap, detected_at}, ...]`
- [ ] **Zero false positives** on current 8 Tier 0 lessons (they are all distinct; the detector outputs `[]`)
- [ ] `/athena:learn` Step 4.6 writes consolidation findings to `docs/context/promotion-proposals/consolidation-YYYY-MM-DD.md`
- [ ] Audit emits `consolidation_detected {clusters, lessons_involved, epic}`
- [ ] Script runs in <2s for 50 lessons (linear pairwise — bounded by lesson count)
- [ ] 5+ fixture tests pass: empty, all-distinct, exact-duplicate, near-duplicate, three-way cluster
- [ ] `@memory-curator` agent mentions consolidation queue as input signal
- [ ] `scripts/hooks/CLAUDE.md` documents `consolidation_detected` event next to E180–E186 schemas
- [ ] Threshold configurable via `CONSOLIDATION_THRESHOLD` env var (default 0.7)

## Alignment / Cross-Epic Hooks

- **Independent epic** — no deps on E187/E188/E189/E191. Ships in Wave 1.
- **Read-only against memory schema** — no writes to lesson files; no migrations; safe to ship without E187 brainstorm landed first
- **Complements E184 `/athena:forget`** — forget archives *weak* lessons (strength-based); E190 detects *duplicate* lessons (theme-based). Together they brake Tier 0 bloat from both directions
- **Feeds E186 dashboard** — `/athena:metrics --memory` can surface consolidation count alongside archive/revive counts in a future enhancement (not in scope for E190 itself)

## Out of Scope

- **Auto-merge** — read-only detector only; human gate via `/athena:learn` queue is mandatory for v1
- **Embedding-based similarity** — simple bag-of-words sufficient for v1; embeddings deferred to Phase 48+ when corpus is larger
- **Cross-project consolidation** — Tier 0 is single-project-scoped today; cross-project detection requires sync infra (Phase 48+)
- **Auto-tuning threshold** — fixed 0.7 for v1; revisit after first cluster detection
- **Real-time detection** — runs on `/athena:learn` invocation (manual / scheduled), not on every `/athena:promote --apply`
- **Sub-cluster splitting** — if a 3-way cluster ought to be split into 1+2, that's a human-curation decision via promotion-proposals review, not automated

## Provenance

- Spec source: `docs/superpowers/specs/2026-05-18-athena-phase-46-roadmap.md` §5 E190
- Approved via `/athena:plan approve E187,E188,E189,E190,E191` on 2026-05-19 (Cycle 20)
