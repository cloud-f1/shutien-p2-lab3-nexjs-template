# E184 — `/athena:forget` Command (forgetting as a feature)

> Phase 45 — Memory Mechanism Maturity | Size: M (4 SP) | Deps: E181

## Problem

Tier 0 grows monotonically. Without a forgetting mechanism:

- Stale lessons crowd out fresh ones in the SessionStart context budget.
- `/athena:promote` (consumer) keeps adding; nothing removes.
- Manual deletion is risky — once gone, the lesson is gone forever (no "did we ever know X?" recovery path).

Ebbinghaus forgetting is **a feature, not a bug**. Trace strength decays naturally; weak traces become harder to retrieve but are not erased. Mirror that.

## Solution

A new command `/athena:forget` that performs a quarterly (or on-demand) **archive sweep**:

1. Read every Tier 0 lesson's strength score (from E181 frontmatter).
2. For each lesson with `S < threshold` (default 0.10):
   - **Move** (not delete) to `~/.claude/template-memory/_archive/<slug>.md`
   - Append a row to `~/.claude/template-memory/_archive/forgotten.md` (timestamp, file, last strength, last_retrieved, reason)
3. Output a summary: N archived, M kept, total Tier 0 line-count delta.

Reversible by design: a future session can `git grep` (or `cat`) `_archive/forgotten.md` to revive a lesson.

### Command surface

```
/athena:forget                  # interactive — prints candidates, asks confirm
/athena:forget --dry-run        # preview only
/athena:forget --apply          # archive without prompt
/athena:forget --threshold 0.05 # custom strength cutoff
/athena:forget --revive <slug>  # move from _archive back to active
```

### Archive structure

```
~/.claude/template-memory/
├── workflow-patterns.md
├── anti-patterns.md
├── ...
└── _archive/
    ├── forgotten.md          # the rolling log
    ├── one-off-bugfix.md     # archived lesson (full content preserved)
    └── stale-pattern.md
```

### `forgotten.md` row format

```markdown
| Date | Lesson | Last strength | Last retrieved | Half-life | Action | Reason |
|------|--------|---------------|----------------|-----------|--------|--------|
| 2026-06-04 | one-off-bugfix.md | 0.07 | 2026-04-01 | 30d | archived | Below threshold, never retrieved |
```

## Key Files

| File | Action |
|---|---|
| `.claude/commands/athena/forget.md` | New — command definition (mirror of `/athena:promote`; same allowed-tools shape) |
| `scripts/memory/forget.sh` | New — the archive engine |
| `~/.claude/template-memory/_archive/` | New directory |
| `~/.claude/template-memory/_archive/forgotten.md` | New — rolling log seeded by first run |
| `.claude/agents/memory-curator.md` | Edit — extend the agent's "Workflow" section with a Mode C — Forget (mirrors Mode A — Proposal-driven and Mode B — Bulk scan); same agent owns both promote and forget |
| `docs/guides/en/memory-system.md` | New — explain promote + forget as the dual mechanisms (and the Ebbinghaus motivation) |

## Implementation

1. Author `forget.sh` with subcommands: `list`, `apply`, `revive`.
2. Implement strength threshold scan (read frontmatter from E181).
3. Atomic archive operation: `mv` (not `cp`+`rm`) so partial failure leaves no half-state.
4. Append to `forgotten.md` after successful move.
5. `revive` does the inverse — checks `_archive/forgotten.md` for the slug, moves the file back, removes the row.
6. Wire `@memory-curator` to invoke this command; agent prompt clarifies "archive, not delete; revival is one command away."
7. Fixture test: synthetic Tier 0 dir with 5 lessons, 2 below threshold → `forget --apply` archives 2, leaves 3, log entry written.
8. Fixture test: revive — `forget --revive <slug>` round-trips correctly.

## Acceptance Criteria

- [ ] `/athena:forget` (interactive) prints candidates, requires confirmation
- [ ] `/athena:forget --dry-run` produces zero filesystem changes (assertable)
- [ ] `/athena:forget --apply` moves lessons atomically; partial-failure safe
- [ ] `forgotten.md` row appended for every archived lesson
- [ ] `/athena:forget --revive <slug>` round-trips a previously archived lesson
- [ ] Strength threshold defaults to 0.10, `--threshold` overrides
- [ ] `git grep` finds archived content (proves reversibility, not data loss)

## Alignment / Cross-Epic Hooks

- **Hard-depends on E181** — strength score is the trigger.
- **Pairs with E183** — promotion follow-through report is the **input** to forget; this epic is the **action**.
- **Mirrors `/athena:promote`** — same agent (@memory-curator), same write target, opposite direction.
- **Documented as the second half of the lifecycle** — every promote eventually forgets unless reinforced.

## Out of Scope

- **Hard delete** — never. Always archive. Add `/athena:forget --purge` later if disk pressure becomes real (it won't — Tier 0 is a few MB).
- **Cross-machine sync** — local-only.
- **Auto-forget on threshold cross** — no. Always human-gated. Forgetting is consequential; do not automate it.
- **Project-level forget (Tier 1)** — Tier 1 is in git. `git rm` + commit is the existing path. Do not duplicate.
