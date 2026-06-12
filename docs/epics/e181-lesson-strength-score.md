# E181 — Lesson Strength Score (decay + reinforcement)

> Phase 45 — Memory Mechanism Maturity | Size: M (5 SP) | Deps: E180

## Problem

Tier 0 grows monotonically (4,085 lines and rising). Every lesson is treated equally regardless of usefulness or freshness. Without a strength signal:

- We cannot rank lessons (which to surface first when context is tight)
- We cannot detect stale lessons (Ebbinghaus decay is real, but unmodeled)
- We cannot detect load-bearing lessons (the ones cited by stop-verifier rule #19 daily are buried beside one-time bug fixes)

This is the second Ebbinghaus epic: turn the retrieval log (E180) into a **per-lesson strength score** that decays with time and reinforces with use.

## Solution

### Frontmatter schema (E181 owns; E182 + E185 extend)

Each Tier 0 lesson file in `~/.claude/template-memory/` (the 8 files listed in `.claude/agents/memory-curator.md` § Template Memory Files) gets YAML frontmatter. **E181 owns the migration**; E182 adds `tags` + `domains`; E185 sets `half_life_days` at promotion time.

```yaml
---
# E181 (this epic)
strength: 0.5         # [0,1], current score; default 0.5 at migration
last_retrieved: 2026-05-04   # ISO date
retrieval_count: 14   # cumulative since migration
created: 2026-03-12   # backfilled from git log

# E185 (set at promotion or backfill)
half_life_days: 180   # default; rubric in e185 spec

# E182 (added when selective inject ships)
tags: [server, auth]
domains: [server/]
---
```

Migration order: E181 ships first with all four E181 fields + a `half_life_days: 180` default. E185 backfills the rubric values when it ships. E182 adds `tags`/`domains` lazily (file-by-file as touched).

### Reinforcement signals (read from `.claude/audit.jsonl` per E180)

| Event | Strength delta |
|---|---|
| `tier0_loaded` (SessionStart inject) | +0.05 |
| `agent_cited` (write-back references lesson) | +0.15 |
| `rule_fired` (stop-verifier blocked, rule backed by lesson) | +0.10 |

All deltas clamped to `[0, 1]`. Multiple events in same session deduplicate (max one bump per signal type per session).

### Decay (nightly or pre-promote)

```
days_since = (now - last_retrieved) / 86400
S = S * 0.5 ^ (days_since / half_life_days)
```

Evergreen lessons (half_life=365) barely move. Incident lore (half_life=30) decays fast.

### Eviction candidate

`S < 0.10` flags the lesson in `/athena:learn` output → suggests `/athena:forget` (E184) review.

## Key Files

| File | Action |
|---|---|
| `~/.claude/template-memory/*.md` | Edit — add YAML frontmatter to the 8 @memory-curator-owned files (one-time migration) |
| `scripts/memory/score.sh` | New — single source of truth for strength math (read, decay, reinforce, write) |
| `/athena:save` command | Edit — invoke `score.sh decay` once per save to amortize decay cost (no separate cron needed) |
| `scripts/hooks/session-start.sh` | Edit — call `score.sh reinforce <lesson> tier0_loaded` after each inject (chains the E180 emit) |
| `scripts/hooks/stop-verifier.sh` | Edit — call `score.sh reinforce <lesson> rule_fired` after each rule trip (chains the E180 emit) |
| `scripts/hooks/subagent-stop-writeback.sh` | Edit — call `score.sh reinforce <lesson> agent_cited` for each citation E180 detects |
| `.claude/audit.jsonl` | Append — new event types `strength_decayed`, `strength_reinforced` |

## Implementation

1. Author `score.sh` with three subcommands: `score.sh get <file>`, `score.sh reinforce <file> <signal>`, `score.sh decay <file>`.
2. Migration script: walk `~/.claude/template-memory/*.md`, prepend frontmatter with defaults (`strength: 0.5`, `half_life_days: 180`, `last_retrieved: today`). Idempotent.
3. Wire reinforcement calls into the two hooks (E180's emit points already give us the right hooks).
4. Add `decay` command — pure math, no I/O beyond writing the new strength back to frontmatter. Run from `/athena:save` to amortize cost (no separate cron needed).
5. Add fixture test: load a synthetic lesson at S=0.5, simulate 30 days passage at half_life=30, verify S=0.25 (within tolerance).
6. Add fixture test: simulate `tier0_loaded` 5x in same session → S only bumps once.

## Acceptance Criteria

- [ ] All 8 `@memory-curator`-owned Tier 0 files have valid YAML frontmatter post-migration (NEW_PROJECT_PRIMER + 7 categories)
- [ ] `score.sh reinforce` correctly applies deltas with clamping and same-session dedup
- [ ] `score.sh decay` matches expected math within 1% tolerance (fixture-tested)
- [ ] `/athena:save` runs decay across all files in <2s
- [ ] Audit log emits `strength_reinforced` and `strength_decayed` events
- [ ] Lessons with `S < 0.10` are flagged in `/athena:learn` output (text only — actual archival is E184)
- [ ] No Tier 0 file's content is altered — only its frontmatter

## Alignment / Cross-Epic Hooks

- **Hard-depends on E180** — reads the retrieval log.
- **Soft-depends on E185** — half-life metadata is the rate constant; falls back to 180-day default if E185 ships later.
- **Powers E184** — `/athena:forget` uses the strength threshold.
- **Powers E186** — strength distribution is a metrics-dashboard column.

## Out of Scope

- **Per-section scoring** — file-level strength only; H2-level granularity is a follow-up.
- **Cross-project strength** — Tier 0 lives in `~/.claude/`; this is the user's local strength view, not shared across machines.
- **Auto-promote based on strength** — strength feeds the human review (`/athena:learn`), never auto-prunes.
- **Tunable deltas via config** — hardcoded constants in `score.sh` for now; tune after 4–6 weeks of data.
