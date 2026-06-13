# docs/epics/ — Epic-Driven Development

> All features flow through the epic pipeline. No ad-hoc development.

## Files

| File | Purpose | Updated By |
|------|---------|------------|
| `EPIC_INDEX.md` | Master progress tracker — single source of truth | Agent after each step |
| `CLAUDE.md` | This file — conventions | Manual |

## Rules

1. **Every feature is an epic** — no work without an epic entry in EPIC_INDEX.md
2. **Pipeline is mandatory**: `spec → implement → qa → commit → merge`
3. **Dependencies must be met** before starting an epic (check Dependency Rules section)
4. **One step at a time** — `/athena:loop` advances exactly one step per invocation
5. **Never skip QA** — coverage gate >=80% blocks merge
6. **Phase boundary pause** — stop and report when all epics in a phase complete
7. **Out-of-order / retro-spec** — work sometimes lands before its spec (Phase 53 was *implemented before spec'd*). The loop reconciles against the **actual ✅/⬜ state matrix**, not a presumed linear order: the next step is the first ⬜ cell scanning `spec → implement → qa → commit → merge`. A ✅ step is never re-run. When an earlier step is ⬜ but a later one is ✅, run the earlier step as a **retro-spec** that *documents what was actually built* (reverse-engineered), not a greenfield design. Details: `.claude/commands/athena/loop.md` → "Out-of-Order Work (Retro-Spec)".

## Adding New Epics

1. Pick the next available E-number
2. Add row to the appropriate Phase table in EPIC_INDEX.md
3. Add dependency rule in the Dependency Rules section
4. Update Phase Parallelism if needed

## Epic Naming Convention

```
E{number} — {Short Name}
Branch: MH/feat/E{number}-{slug}
Commit: feat(E{number}): {description}
```

## File Organization

- `docs/epics/EPIC_INDEX.md` — master tracker (state + catalog)
- `docs/epics/e{n}-{slug}.md` — detailed spec per epic (created during `spec` step)
- `docs/context/epic-progress.md` — lightweight state file (IDs + status only, read by loop)
- `docs/roadmap.md` — high-level product vision (NOT execution tracking)
- `docs/context/session-summary.md` — session resume point (references current epic)
