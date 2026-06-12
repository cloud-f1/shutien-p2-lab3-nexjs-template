# Starting a New Project — Archive Template Epics, Start From E1

> When you fork this template and want to start your own product, use this workflow to preserve the template's epic history as reference material while your own epic numbering begins at E1.

## Why Archive (Not Delete)

This template has accumulated 160+ epics (E1–E166 across 42 phases), each a battle-tested pattern:

- Testing pyramid × coverage gate × Stop-verifier rules
- Agent-team architecture × epic pipeline × QA gate
- Schemathesis contract checks × Alembic migration review × autopilot confidence scoring

These aren't noise — they're a case library you'll want to browse when making technical decisions. Delete them and they're gone. Archive them and you can `grep`, copy patterns, and learn why something was designed a certain way.

## One Command

```bash
make new-project
```

This calls `scripts/template-reset.sh --archive`, which:

| Step | Action |
|------|--------|
| 1 | Moves `docs/epics/e*.md` + `docs/epics/phase-*-prd.md` → `docs/epics/_archive/<YYYY-MM-DD>-from-template/` |
| 2 | Snapshots the current `EPIC_INDEX.md` as `_archive/<date>/EPIC_INDEX.md.snapshot` |
| 3 | Writes `README.md` in the archive dir explaining it's template heritage |
| 4 | Resets `EPIC_INDEX.md` from `docs/templates/epics/EPIC_INDEX.md` (blank tracker, Phase 0, next epic = E1) |
| 5 | Resets all `docs/context/*.md` logs from `docs/templates/context/` |
| 6 | Removes template-only skills and backward-compat shims |

## Resulting Project Structure

```
docs/epics/
├── EPIC_INDEX.md                    # Blank tracker; you write E1 here
├── CLAUDE.md                        # Preserved (epic development conventions)
└── _archive/
    └── 2026-04-24-from-template/
        ├── README.md                # Explains this is template heritage
        ├── EPIC_INDEX.md.snapshot   # Final template state (160+ epics)
        ├── e1-*.md … e166-*.md      # All epic specs
        └── phase-*-prd.md           # All phase PRDs
```

## Create Your First Epic

```bash
git checkout -b MH/feat/E1-my-first-feature
/athena:spec E1 "User registration + email verification"
/athena:loop
```

`/athena:loop` reads `docs/epics/EPIC_INDEX.md` and walks E1 through the pipeline (spec → implement → qa → commit → merge). The archived E1–E166 are **not** picked up by the loop — they live in `_archive/` as reference only.

## Referencing Template Patterns Later

Example: you want to implement user session management and want to see how the template handled it.

```bash
grep -l "session" docs/epics/_archive/*/e*.md
# → docs/epics/_archive/.../e161-auth-adapter-sunset-refresh-hardening.md
```

The archived epics remain searchable markdown. Copy-paste sections, borrow acceptance criteria, adapt the migration-review pattern.

## When Not to Run `make new-project`

- **You're maintaining the template itself** — this would clear the template epics you're working on
- **Uncommitted changes exist** — `git status` should be clean; the command modifies many files
- **You've already run it and written E1** — a second run would archive your own E1 too (unless that's what you want)

## Rollback

Reversible because it's `mv`, not `rm`:

```bash
mv docs/epics/_archive/<date>-from-template/e*.md docs/epics/
mv docs/epics/_archive/<date>-from-template/phase-*-prd.md docs/epics/
mv docs/epics/_archive/<date>-from-template/EPIC_INDEX.md.snapshot docs/epics/EPIC_INDEX.md
rm -rf docs/epics/_archive/<date>-from-template/
```

Or `git reset --hard HEAD` if you haven't committed.

## Difference from `make init`

| Command | Epic handling | Other steps |
|---------|---------------|-------------|
| `make init` | **Deletes** epic files | Deps install, DB init, migrations, Site Builder CLI |
| `make new-project` | **Archives** epic files | Only resets epics + context; doesn't touch deps/DB/build |

- Full post-clone initialization → `make init` (but deletes template epics)
- Archive template epics, start from E1 only → `make new-project`
- Both → run `make new-project` first (preserves archive), then manually `make setup ensure-db migrate generate-types`
