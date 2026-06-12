# Memory System

> How lessons flow from "this project" up to "every future project" — and
> how we tune which lessons stay relevant over time.

The template ships a two-tier memory system maintained by the
`@memory-curator` agent (see `.claude/agents/memory-curator.md`).

## Tiers

| Tier | Path | Scope | Lifetime |
|---|---|---|---|
| Tier 0 | `~/.claude/template-memory/` | Cross-project wisdom | Years (per file half-life) |
| Tier 1 | `docs/context/` | This project's state | Until auto-compact (E160) |

When you tag a debug log entry `[GENERALIZABLE]`, the
`scripts/hooks/auto-promote-check.sh` PostToolUse hook eventually drafts a
proposal in `docs/context/promotion-proposals/<ts>.md`. Running
`/athena:promote --apply <proposal>` invokes `@memory-curator`, which:

1. Picks the right Tier 0 file for each lesson (the **category**)
2. Appends the lesson under the appropriate section
3. Regenerates `NEW_PROJECT_PRIMER.md` (the cross-project bootstrap digest)
4. Runs the half-life backfill so every Tier 0 file carries a default
   decay rate in its frontmatter

## File → Half-Life Mapping (E185)

The category **is** the half-life. There is no separate rubric for the
curator to apply — once a lesson is filed under `failure-patterns.md`, it
inherits a 30-day half-life from the file.

| Tier 0 file | Default `half_life_days` | Why |
|---|---|---|
| `architecture-lessons.md` | **365** | Decisions that proved durable; survive stack changes |
| `anti-patterns.md` | **365** | Things never to do; reasons rarely expire |
| `security-learnings.md` | **365** | Vulnerabilities + their fixes — high cost if forgotten |
| `failure-patterns.md` | **30** | Specific bug + fix — once internalized, can fade |
| `integration-gotchas.md` | **90** | Third-party surprises — relevant until vendor changes API |
| `testing-patterns.md` | **180** | Test approaches — durable but tied to current stack |
| `performance-insights.md` | **180** | Performance learnings — tied to current infrastructure |
| `NEW_PROJECT_PRIMER.md` | **365** | The curated digest — load-bearing, always-on |

Single source of truth: `scripts/memory/half-life-defaults.json`. Edit
that JSON, not multiple agent prompts.

### Per-lesson overrides

If a particular lesson genuinely deserves a different half-life from its
category, add a YAML frontmatter block on the lesson's own file (rare — a
few times a year). The resolver (`scripts/memory/half-life-resolve.sh`)
checks frontmatter first, falls back to the JSON map by filename, then
falls back to a 180-day default.

```markdown
---
half_life_days: 730
reason: framework-fundamental — won't change with stack moves
---
# Some Lesson Title
```

## How decay actually works (E181, future)

The decay rate constant in E181's strength-score equation reads
`half_life_days` from each file. Lessons with a long half-life rarely
cross the forget threshold and stay in `NEW_PROJECT_PRIMER.md`. Lessons
with a short half-life (incident lore in `failure-patterns.md`) fade
naturally as the team internalizes the fix.

## Reviewing the rubric

If you think a lesson is in the wrong file (and so getting the wrong
half-life), edit the Tier 0 file by hand. The curator does not negotiate
categorization — disagreements are resolved by humans editing
`~/.claude/template-memory/` directly.

## Backfill

Run any time after editing the JSON map or adding a new Tier 0 file:

```bash
scripts/memory/backfill-half-life.sh
```

The script is idempotent — running twice produces identical content.
`/athena:promote` calls it automatically as part of its default flow.

## See also

- `.claude/agents/memory-curator.md` — agent prompt (rubric + workflow)
- `scripts/memory/half-life-defaults.json` — the rate map
- `scripts/memory/half-life-resolve.sh` — resolver (frontmatter → JSON → 180 default)
- `scripts/memory/backfill-half-life.sh` — one-time + ongoing safety net
- E181 — strength-score decay (consumes the half-life)
- E184 — forget-threshold archival (consumes the half-life)
