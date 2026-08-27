# docs/epics/ — Epic-Driven Development

> All features flow through the epic pipeline. No ad-hoc development.

## Files

| File | Purpose | Updated By |
|------|---------|------------|
| `EPIC_INDEX.md` | Master progress tracker — single source of truth | Agent after each step |
| `CLAUDE.md` | This file — conventions | Manual |

## SSOT — Write Order (E196 / E353)

`EPIC_INDEX.md` in this directory is a **derived file**, not the source of truth:

```
docs/context/epic-progress.md   ← SSOT (scripts/epic-graph.sh reads ONLY this file)
        │  scripts/state/render-index.sh   (prose-preserving merge/render)
        ▼
docs/epics/EPIC_INDEX.md        ← derived (human-readable, keeps historical prose)
```

Whenever a phase/epic status changes:

1. Edit **`docs/context/epic-progress.md`** (the SSOT) first.
2. Run **`scripts/state/render-index.sh`** to re-render `EPIC_INDEX.md` from it.
3. Commit **both files together** in the same commit.

**Never hand-edit the sentinel blocks in `EPIC_INDEX.md`** —
`<!-- PHASE_STATUS_START -->…<!-- PHASE_STATUS_END -->` or
`<!-- EPIC_MATRIX_START -->…<!-- EPIC_MATRIX_END -->`. Those blocks are
machine-rendered from the SSOT; editing them directly makes the two files
disagree, and nothing will re-sync them for you.

**Real incident:** on 2026-08-24, closing out Phase 85 edited the *derived*
file (`EPIC_INDEX.md`) directly without touching the SSOT. PR #136 merged
carrying 13 drifted cells (e.g. `Phase 85 🟢 AP→✅`, `E350 Impl:⬜→✅`, …) and
the mismatch was only caught by chance while cross-checking a memory file
afterward — fixed after the fact in PR #137. Re-running `check-drift.sh`
against the `epic-progress.md` state as it stood at PR #136 reproduces the
exact failure it would have caught: `13 mismatch(es) found` / exit 1. That
detector (`scripts/state/check-drift.sh`) is now wired into
`scripts/pre-merge-check.sh`'s **State drift** gate (E353), so this class of
mistake fails the merge gate instead of silently shipping. If that gate ever
fails for you, the fix is exactly steps 1–3 above — edit the SSOT, re-render,
commit both.

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
Branch: feat/E{number}-{slug}
Commit: feat(E{number}): {description}
```

## File Organization

- `docs/epics/EPIC_INDEX.md` — master tracker (state + catalog)
- `docs/epics/e{n}-{slug}.md` — detailed spec per epic (created during `spec` step)
- `docs/context/epic-progress.md` — lightweight state file (IDs + status only, read by loop)
- `docs/roadmap.md` — high-level product vision (NOT execution tracking)
- `docs/context/session-summary.md` — session resume point (references current epic)
