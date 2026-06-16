# DBA — Migration Review Notes

> `@dba`'s designated document. Append migration review notes, schema-design
> decisions, and recurring red-flag patterns here. Read this first (most-recent
> last) before reviewing a migration.

Stack: **Drizzle ORM + postgres-js + drizzle-kit**. Migrations are plain `.sql` in
`next-app/drizzle/migrations/` indexed by `meta/_journal.json`. Schema source:
`next-app/lib/schema/{auth,items,billing,system}.ts` (barrel `index.ts`). Generate
with `pnpm db:generate`, apply with `pnpm db:migrate`, verify a fresh-DB apply with
`pnpm db:test-migrate`, detect drift with `npx drizzle-kit check`. drizzle-kit does
**not** emit a downgrade — reverse plans are hand-authored at review time.

Formal sign-offs go to `docs/context/migration-review/<rev>-signoff.md` (template in
`.claude/agents/dba.md`). Red-flag cheatsheet (DROP COLUMN/TABLE/INDEX, ALTER COLUMN
TYPE, in-place pgEnum edits) also lives there.

---

## Decisions & recurring patterns

_(none yet — append entries below as migrations are reviewed)_
