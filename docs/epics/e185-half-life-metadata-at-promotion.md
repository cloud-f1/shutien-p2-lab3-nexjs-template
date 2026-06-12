# E185 — Half-Life Metadata at Promotion (calibrate the decay rate)

> Phase 45 — Memory Mechanism Maturity | Size: S (2 SP) | Deps: none (sequencing tip: ship alongside E181)

## Problem

A single decay rate is wrong for all lessons. Some are evergreen invariants (`folder is server/, not backend/` — true forever). Others are stack-specific (`fastapi-users v15 sha256 family-revoke pattern` — true until we change auth libs). Others are incident lore (`E157 alembic migration review fix` — relevant until the lesson gets internalized in habit).

If everything decays at the same rate, evergreen lessons get spuriously archived and incident lore lingers too long. **The half-life is the most important parameter in the whole memory system.** Get this right and the rest of E181/E184 calibrates itself.

## Solution

`@memory-curator` already categorizes lessons into 7 category files (per `.claude/agents/memory-curator.md` § Template Memory Files) plus the `NEW_PROJECT_PRIMER.md` digest. The category **is the half-life**. No new categorization rubric — reuse the existing one.

| Tier 0 file | Default `half_life_days` | Rationale |
|---|---|---|
| `architecture-lessons.md` | **365** | Decisions that proved durable; survive stack changes |
| `anti-patterns.md` | **365** | Things never to do; reasons rarely expire |
| `security-learnings.md` | **365** | Vulnerabilities + their fixes — high cost if forgotten |
| `failure-patterns.md` | **30** | Specific bug + fix — once internalized, can fade |
| `integration-gotchas.md` | **90** | Third-party surprises — relevant until vendor changes API |
| `testing-patterns.md` | **180** | Test approaches — durable but tied to current stack |
| `performance-insights.md` | **180** | Performance learnings — tied to current infrastructure |
| `NEW_PROJECT_PRIMER.md` | **365** | The curated digest — load-bearing, always-on |

Half-life is **the file the lesson is promoted into**, not a separate decision the curator makes. Per-section overrides allowed (rare) for lessons that stand out in their category.

User-visible: `@memory-curator` no longer needs a rubric prompt — it just classifies (which it already does) and the half-life follows from the category.

## Key Files

| File | Action |
|---|---|
| `.claude/agents/memory-curator.md` | Edit — add the file→half-life table to § Template Memory Files; clarify that categorization sets the rate |
| `~/.claude/template-memory/*.md` | Edit — backfill `half_life_days` on the 8 existing files using the file-default table (one-time pass; E181 owns the broader frontmatter migration) |
| `scripts/memory/half-life-defaults.json` | New — `{ "anti-patterns.md": 365, ... }` — single source of truth read by `score.sh` (E181) and the memory-curator agent |
| `docs/guides/en/memory-system.md` | New (shared with E184) — document the file→half-life mapping so human reviewers can spot misclassifications |

## Implementation

1. Author `scripts/memory/half-life-defaults.json` with the 8-row mapping above.
2. Update `@memory-curator`'s § Template Memory Files table with a "Default half-life" column.
3. One-time backfill: walk the 8 Tier 0 files, set `half_life_days` from the JSON map. No new rubric for the curator to learn — it already classifies into these files.
4. `score.sh` (from E181) reads `half_life_days` from frontmatter; falls back to the JSON map by filename; falls back to 180 if neither is present.
5. Fixture test: backfill is idempotent (running twice produces the same frontmatter).
6. Fixture test: a lesson promoted into `failure-patterns.md` ends up with `half_life_days: 30`.

## Acceptance Criteria

- [ ] `scripts/memory/half-life-defaults.json` exists with the 8-row mapping
- [ ] `@memory-curator` system prompt links to the file and the table
- [ ] All 8 Tier 0 files have `half_life_days` set after backfill
- [ ] `score.sh` resolution order works: frontmatter → JSON map → 180 default (fixture-tested)
- [ ] User-facing guide documents the file→half-life relationship

## Alignment / Cross-Epic Hooks

- **Powers E181** — half-life is the rate constant in the decay equation.
- **Powers E184** — high-half-life lessons rarely cross the forget threshold.
- **Refines @memory-curator** (E158 consumer) — adds discrimination at the promotion gate.
- **Sequencing**: can ship before E181 — frontmatter migration is shared work.

## Out of Scope

- **Auto-tuning half-life from retrieval data** — not yet. Ship the rubric, gather 6 months of data, then consider learning the rate constants.
- **Per-section half-life** — file-level only.
- **Negotiating the rubric** — categorization is the agent's call. Disagreements get edited manually post-promotion.
- **Migrating Tier 1 with half-lives** — out of scope; Tier 1 has its own auto-compact policy (E160).
