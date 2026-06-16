# Migration Review Artifacts

This directory holds **@dba sign-offs** for risky Drizzle migrations that land
on `main`.

## Why this directory exists

Drizzle migrations are plain `.sql` files in `next-app/drizzle/migrations/`
(e.g. `0006_spooky_rachel_grey.sql`). The `.sql` **is** the migration — there
is no separate offline-SQL emit step. `drizzle-kit generate` produces these
files from schema diffs, and `drizzle-kit migrate` / `pnpm db:test-migrate`
applies them.

`drizzle-kit generate` is a diff — like any autogenerator it can quietly
produce a destructive statement (a column rename surfaces as DROP + ADD, an
enum edit as an in-place type rewrite). Those need a human eye before they run
against a live database.

## Workflow

`@dba` (`.claude/agents/dba.md`) and `/athena:dba review` read the `.sql`
files directly, scan for red flags, and — when any are found — write a
`<rev>-signoff.md` sign-off into **this** directory.

`<rev>` is the migration's numeric prefix (the `0006` in
`0006_spooky_rachel_grey.sql`).

## Red flags (scanned in the `.sql`)

| Pattern | Why it's a red flag |
|---|---|
| `DROP COLUMN` | Data loss; often the autogenerator's guess for a rename |
| `DROP TABLE` | Data loss; verify it was truly dead code |
| `DROP INDEX` | Performance regression risk on hot queries |
| `ALTER COLUMN ... TYPE` | Type change is not transactional under load on PG; needs a multi-step migration |
| In-place enum edits | Adding/removing/reordering enum values rewrites the type in place; PG enum changes have transaction caveats |

## @dba sign-off template

When a migration trips a red flag, `@dba` writes the following file and commits
it alongside the migration:

```markdown
# Migration Review — <rev>

- Reviewed: <YYYY-MM-DD>
- Reviewer: @dba
- Migration: next-app/drizzle/migrations/<rev>_<slug>.sql

## Red flags observed

- [ ] DROP COLUMN on `<table>.<col>` — decision: accepted (column unused for
      30+ days, verified via `git log -S '<col>'`)
- [ ] ALTER COLUMN TYPE on `<table>.<col>` — decision: rejected, requires a
      multi-step (add new column → backfill → swap) migration

## Decision

**GO** | **NOGO**

(One line of reasoning. NOGO must reference the rejected red flag(s).)

## Rollback plan

<SQL or procedural steps for undoing this migration in production. For a
DROP COLUMN, this is the additive column re-add plus the backfill needed to
repopulate. For an ALTER TYPE, the inverse cast plus any constraint rebuild.>
```

## Cleanup policy

Sign-offs are **append-only** historical evidence of what shipped. Do not
delete them in regular maintenance — if the file count becomes unwieldy,
archive into a dated subdirectory rather than `rm`'ing.
