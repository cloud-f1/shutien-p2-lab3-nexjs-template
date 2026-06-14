# Memory System

The @saas agent team uses a two-tier memory system to persist knowledge across sessions.

## Tiers

```
Tier 0 (global):  ~/.claude/template-memory/    cross-project wisdom (15 files)
Tier 1 (project): docs/context/                 this project's state (16 files)
```

## Tier 0 — Cross-Project Wisdom

Tier 0 contains generalizable lessons extracted from all projects. It's stored in `~/.claude/template-memory/` so it's available in any Claude Code session.

```bash
/athena:promote     # extract Tier 1 lessons → Tier 0
/athena:forget      # archive weak Tier 0 lessons (Ebbinghaus brake)
```

## Tier 1 — Project State

Tier 1 is this project's specific context, stored in `docs/context/`:

| File | Purpose |
|------|---------|
| `session-summary.md` | Last session's state — read at session start |
| `epic-progress.md` | Lightweight state file (IDs + status only) |
| `agent-memory.md` | Each agent's accumulated knowledge |
| `migration-review/` | SQL artifacts for the migration review gate |

## Commands

```bash
/athena:save    # checkpoint all agents → write context docs → commit
/athena:load    # load project context → summarize state (session start)
/athena:learn   # refresh MEMORY.md accuracy → detect drift → suggest promote
```

## Memory-Aware Planning

`/athena:plan brainstorm` reads Tier 0 lessons scored by relevance and injects
them as design considerations before the brainstorm dialogue begins.

```bash
/athena:plan brainstorm "notifications system"
# → loads relevant Tier 0 lessons
# → 7-step Q&A dialogue
# → emits enriched epic file
```
