# E186 — Memory Metrics Dashboard (`/athena:metrics --memory`)

> Phase 45 — Memory Mechanism Maturity | Size: S (3 SP) | Deps: E180

## Problem

E180 emits retrieval events. E181 maintains strength scores. E183 surfaces stale promotions. E184 archives. But there is no **single view** that lets a human answer:

- Which Tier 0 lessons are pulling weight? (most-retrieved)
- Which are dead weight? (never-retrieved, low strength)
- How is the strength distribution shifting over time? (healthy long-tail vs. cliff)
- Is my promotion cadence too aggressive or too conservative? (creates/week vs. forgets/week)
- Which stop-verifier rules cite which lessons? (the cross-reference)

Without this view, harness tuning is guesswork.

## Solution

Extend the existing `/athena:metrics` command (E146) with a `--memory` flag that aggregates all the signals into one report.

### Output sections

```
=== Memory Metrics — 2026-06-04 ===

[Top 10 Retrieved Lessons]            [Never Retrieved (last 30d)]
1. workflow-patterns.md       42x     1. one-off-bugfix-X.md     (0)
2. anti-patterns.md           38x     2. stale-pattern-Y.md      (0)
...

[Strength Distribution]              [Half-Life Distribution]
S < 0.1   ▓             2 (forget)   30d   ▓▓        4
0.1-0.3   ▓▓▓           5 (decay)    90d   ▓▓▓▓      6
0.3-0.6   ▓▓▓▓▓▓        8 (active)   180d  ▓▓▓▓▓▓▓▓ 12
0.6-1.0   ▓▓▓▓▓▓▓▓▓▓   14 (strong)   365d  ▓▓▓▓     7

[Stop-Verifier Citation Map]
Rule #19 (Migration Review) ── alembic-patterns.md           18 fires
Rule #21 (No new page CSS)  ── design-system-patterns.md      9 fires
Rule #07 (No localStorage)  ── auth-storage-patterns.md       7 fires
...

[Tier 0 Trend (last 90 days)]
+ promoted:  21 lessons
- archived:   3 lessons
Net Δ:      +18 (1,247 → 1,402 lines)

[Cadence Health]
Promotion rate: 0.23 lessons/day
Forget rate:    0.03 lessons/day
Net growth:     +0.20 lessons/day → review threshold tighten
```

## Key Files

| File | Action |
|---|---|
| `.claude/commands/athena/metrics.md` | Edit — add `--memory` flag (composable with existing `--epic` + `--since`); preserve "no side effects" guardrail |
| `scripts/memory/metrics.sh` | New — aggregator (reads `.claude/audit.jsonl` for E180 events + Tier 0 frontmatter for strength/half-life) |
| `docs/guides/en/memory-system.md` | Edit (shared with E184/E185) — link to the dashboard section |

## Implementation

1. Author `metrics.sh --memory`:
   - Parse `.claude/audit.jsonl` with `jq` filtering on `event == "tier0_loaded" / "rule_fired" / "agent_cited"` (E180 event types) to compute top-N + never-retrieved.
   - Walk the 8 `~/.claude/template-memory/*.md` files' frontmatter for strength + half-life buckets.
   - Cross-reference `rule_fired` events (`.rule_id` + `.lesson` from the rule-to-lesson.json map) for the citation table.
   - Compute trend deltas from `audit.jsonl` events: `auto_promote_proposed` (E158), forget events (added by E184), `agent_complete` (E146 — already present).
2. Render ASCII histograms with simple `printf` (no chart deps).
3. Honor the existing `--epic E{n}` and `--since YYYY-MM-DD` filters from E146 — pass through to the jq filters.
4. `--memory` runs alone OR composes with `--epic` / `--since`. Without `--memory`, behavior is unchanged from E146.
5. Wire into `.claude/commands/athena/metrics.md` Step 2 / 3 — add a new branch when `--memory` is present.
6. Fixture test: synthetic retrieval events + frontmatter → expected histogram output.
7. Fixture test: `--memory --since 2026-05-01` correctly time-filters retrieval events.

## Acceptance Criteria

- [ ] `/athena:metrics --memory` produces all 6 sections with non-empty data after E180/E181 ship and run for 1 session
- [ ] `/athena:metrics` (no flags) behavior is **unchanged** from E146 — full backwards compat
- [ ] `/athena:metrics --memory --epic E180 --since 2026-05-01` correctly composes filters
- [ ] Top-10 retrieved is correct against fixture data
- [ ] Never-retrieved excludes lessons younger than 30 days (matches E183 logic)
- [ ] Strength + half-life histograms are normalized to bucket counts
- [ ] Stop-verifier citation map cross-references rules ↔ lessons accurately (uses E180's `rule-to-lesson.json`)
- [ ] Command preserves the "no side effects" guardrail — read-only across all flag combinations

## Alignment / Cross-Epic Hooks

- **Hard-depends on E180** — read retrieval.jsonl.
- **Soft-depends on E181** — strength bucket needs the score, but degrades gracefully if E181 unshipped (skip section).
- **Soft-depends on E184** — forget-rate needs forget events, skip if absent.
- **Extends E146** — same command surface (`/athena:metrics`); no new command.

## Out of Scope

- **Time-series persistence** — single-snapshot only. Cross-session trend lines need a metrics store; not building one.
- **Per-machine aggregation** — local view only.
- **UI visualization** — ASCII only.
- **Alerting / automation** — pure read-only report.
