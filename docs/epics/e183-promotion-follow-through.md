# E183 — Promotion Follow-Through (premature promotion detection)

> Phase 45 — Memory Mechanism Maturity | Size: S (3 SP) | Deps: E180

## Problem

`/athena:promote --apply` is fire-and-forget. Once a lesson lands in Tier 0, we have no feedback loop on whether the promotion was a good decision. A lesson can sit unread for 90 days and we will not notice. Without follow-through:

- We cannot tune `@memory-curator`'s promotion threshold (over-promoting? under-promoting?)
- We cannot detect lessons that were over-generalized (looked promotable but only the original project ever needed them)
- We have no signal to feed back into the promotion-proposer hook (E158) to refine its tagging

## Solution

Extend `/athena:learn` (or a new sub-command `/athena:learn --promotions`) with a **stale-promotion report**:

1. Read every Tier 0 lesson's frontmatter — `created` date and `retrieval_count` (E181).
2. For each lesson promoted ≥ 30 days ago with `retrieval_count == 0`:
   - Surface as "premature promotion candidate"
   - Attach context: original promotion proposal path, originating agent, original signal count
3. Output is a markdown report — human reviews and decides:
   - **Keep** — bump strength manually, lesson is still relevant
   - **Demote** — move back to Tier 1 (project-specific) — out of scope, manual for now
   - **Forget** — invoke `/athena:forget` (E184)

### Report format

```markdown
# Stale Promotions — 2026-06-04

## Premature Promotion Candidates (3)

### workflow-patterns.md#one-time-bug-fix-Z
- Promoted: 2026-04-01 (64 days ago)
- Retrieval count: 0
- Original proposer: docs/context/promotion-proposals/20260331-...md
- Original signal: 3 [GENERALIZABLE] tags from @debugger
- Suggested action: /athena:forget — looks like incident lore that didn't generalize
```

## Key Files

| File | Action |
|---|---|
| `.claude/commands/athena/learn.md` | Edit — add `--promotions` flag handler |
| `scripts/memory/promotion-follow-through.sh` | New — produces the stale-promotion report |
| `docs/context/strategy-log.md` | Read — cross-references promotion proposals to original cycles |

## Implementation

1. Author `promotion-follow-through.sh` — walks the 8 `@memory-curator`-owned files in `~/.claude/template-memory/`, reads frontmatter `created` + `retrieval_count` (E181-introduced).
2. Cross-reference with `docs/context/promotion-proposals/*.md` (the auto-promote-check.sh hook drafts files at this path; archive-context.sh writes `archive-<ts>.md` here too — both formats parsed) to find the original proposal file.
3. Render markdown report to stdout. Wire `/athena:learn --promotions` to invoke this and emit the report as a new "Stale Promotions" section in its standard output.
4. Add report rendering inside the existing `/athena:learn` command flow (after Step 4 "Scan for generalizable lessons") rather than a new sub-command — preserves the single-command entry point.
5. Fixture test: synthetic lesson promoted 60 days ago with retrieval_count=0 → appears in report. Synthetic lesson promoted 60 days ago with retrieval_count=5 → does not appear.

## Acceptance Criteria

- [ ] `/athena:learn --promotions` emits a markdown report with 0 false positives on the current Tier 0 (manual review by user)
- [ ] Report includes original proposal path + originating agent for traceability
- [ ] Lessons with `created < 30 days ago` are excluded (too early to judge)
- [ ] Lessons with `retrieval_count > 0` are excluded (working as intended)
- [ ] Report is idempotent — running twice in a row produces identical output

## Alignment / Cross-Epic Hooks

- **Hard-depends on E180** — needs `retrieval_count` from the log.
- **Hard-depends on E181** — reads the frontmatter that E181 introduces.
- **Feeds into E184** — `/athena:forget` consumes this report.
- **Tunes E158 producer/proposer** — over time, "premature" patterns reveal which agent tags are noisy.

## Out of Scope

- **Auto-demotion** — strictly human-reviewed. The report flags; the human decides.
- **Demote to Tier 1** — moving Tier 0 → Tier 1 is awkward (Tier 1 is project-specific by design). Out of scope for this epic; users archive instead via E184.
- **30-day threshold tuning** — hardcoded for v1; revisit after data.
- **Aggregation across projects** — single-machine view only.
