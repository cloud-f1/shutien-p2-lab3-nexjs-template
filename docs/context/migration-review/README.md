# Migration Review Artifacts (E157)

This directory holds the **offline SQL emit + sign-off** for every Alembic
migration that lands on `main`. Every file under
`server/alembic/versions/` must have a matching pair of artifacts here
before it is allowed to merge.

## Why this directory exists

`alembic revision --autogenerate` is a heuristic — it silently misses several
classes of schema change (column rename, enum value add/remove, partial /
expression indexes, `CheckConstraint` changes, `server_default` expression
changes, PG-only types vs SQLite). Today the pipeline runs
`alembic upgrade head` on production startup, so each unreviewed migration
becomes a live-fire test.

E157 makes migration review a **mandatory @qa Phase 2.6** that auto-runs
when `server/alembic/versions/*.py` files changed in the PR. Generated SQL
plus an @dba sign-off live here, on disk, version-controlled. Stop
verifier Rule #19 refuses to let a feat branch finish without them, and
`pre-deploy-guard.sh` re-emits the SQL pre-deploy and compares hashes — if
the SQL changed since @qa ran, the deploy is blocked.

## File naming

```
<rev>-<YYYYMMDD-HHMMSS>-upgrade.sql   # offline `alembic upgrade <rev> --sql`
<rev>-<YYYYMMDD-HHMMSS>-downgrade.sql # offline `alembic downgrade -1 --sql`
<rev>-signoff.md                      # @dba sign-off (only required on red flag)
```

`<rev>` is the alembic revision id (the prefix of the version filename, e.g.
the `abcd1234` in `abcd1234_add_user_sessions.py`). The timestamp segment
makes consecutive emits sortable and disambiguates re-runs.

## Red flags (script-detected)

`scripts/migration-review.sh` `grep -E`s the upgrade SQL for these patterns
and prints a warning to stderr per match. Any match is **mandatory @dba
sign-off territory** — @qa must spawn @dba and wait for a GO before the
epic can move past Phase 2.6.

| Pattern              | Why it's a red flag                                           |
|----------------------|---------------------------------------------------------------|
| `DROP COLUMN`        | Data loss; autogenerate often emits this for rename mistakes  |
| `DROP TABLE`         | Data loss; verify it was truly dead-code                      |
| `DROP INDEX`         | Performance regression risk on hot queries                    |
| `ALTER COLUMN ... TYPE` | Type change is not transactional under load on PG; needs multi-step migration |

## @dba sign-off template

When `scripts/migration-review.sh` reports red flags, @qa spawns @dba and
@dba writes the following file, then commits it alongside the *.sql
artifacts:

```markdown
# Migration Review — <rev>

- Reviewed: <YYYY-MM-DD>
- Reviewer: @dba
- Artifacts: <rev>-<ts>-upgrade.sql, <rev>-<ts>-downgrade.sql

## Red flags observed

- [ ] DROP COLUMN on `<table>.<col>` — decision: accepted (column unused for
      30+ days, verified via `git log -S '<col>'` on `server/`)
- [ ] ALTER COLUMN TYPE on `<table>.<col>` — decision: rejected, requires
      pt-osc / multi-step migration

## Decision

**GO** | **NOGO**

(One line of reasoning. NOGO must reference the rejected red flag(s).)

## Rollback plan

<SQL or procedural steps for undoing this migration in production. For
DROP COLUMN, this is the additive `op.add_column(...)` plus the backfill
SQL needed to repopulate. For ALTER TYPE, the inverse type cast plus any
constraint rebuild.>
```

## Generating the artifacts

```bash
# From repo root, with your active feat/E{n}-* branch checked out:
scripts/migration-review.sh <rev>      # rev defaults to `head`
```

The script:
1. Emits `<rev>-<ts>-upgrade.sql` via `uv run alembic upgrade <rev> --sql`
2. Emits `<rev>-<ts>-downgrade.sql` via `uv run alembic downgrade -1 --sql`
   (empty file if the revision is the first; intentional, see script).
3. Greps the upgrade SQL for the red-flag patterns above and prints
   warnings to stderr.
4. Exits 0 either way — the **enforcement** lives in Stop verifier Rule
   #19 and `pre-deploy-guard.sh`'s secondary gate, not in the script.

## How this directory is enforced

| Boundary | Enforcer | Action on miss |
|----------|----------|----------------|
| @qa Phase 2.6 | `qa.md` instructions | FAIL @qa, do not proceed to Phase 3 (coverage) |
| Stop on `feat/e{n}-*` | `scripts/hooks/stop-verifier.sh` Rule #19 | exit 2 — refuse Stop, ask agent to run `scripts/migration-review.sh <rev>` |
| `git push` / deploy | `scripts/hooks/pre-deploy-guard.sh` secondary gate | exit 2 — refuse deploy, mismatch between pre-QA emit and current emit means the migration changed mid-flight |

## Cleanup policy

Artifacts are **append-only**. Old SQL emits stay around as historical
evidence of what shipped. Do not delete them in regular maintenance — if
the file count becomes unwieldy, archive into a dated subdirectory rather
than `rm`'ing.
