---
description: "(ops) Database admin → inspect Drizzle migrations → lint SQL → diagnose errors → fix suggestions."
allowed-tools: Read, Bash, Grep, Glob, Edit, Write
---

# /athena:dba — Database Administration Command

Inspect, lint, and manage **Drizzle / drizzle-kit** migrations. Subcommand-driven.

> Stack: Drizzle ORM + postgres-js + drizzle-kit. Migrations are **plain `.sql`**
> files in `next-app/drizzle/migrations/` indexed by `meta/_journal.json` — NOT
> Alembic Python revisions. The schema source is `next-app/lib/schema/{auth,items,
> billing,system}.ts` (barrel `lib/schema/index.ts`, wired in `drizzle.config.ts`).
> drizzle-kit `generate` does **not** emit a downgrade — reverse SQL is hand-authored
> at review time. Deep migration patterns live in the `nextjs-saas-patterns` skill (§5).
> All commands run from `next-app/`.

## Parse Arguments

Parse `$ARGUMENTS` for the subcommand:

| Subcommand | Action |
|------------|--------|
| `inspect` (default) | Read and summarize all `.sql` migration files |
| `inspect NNNN` | Deep-inspect a specific migration (e.g., `inspect 0006`) |
| `lint` | Scan migrations for risky patterns + fresh-DB apply check |
| `history` | Show the migration chain from `_journal.json` |
| `diagnose <error>` | Analyze a migration/DB error and suggest a fix |
| `fix NNNN` | Propose fixes for risky patterns in migration NNNN |
| `status` | Journal head + drift check (`drizzle-kit check`) + apply check |
| `new <description>` | Generate a migration (`db:generate`) + lint + review |
| `review <rev>` | Read the migration SQL, scan red flags, delegate to @dba on hit (E157) |

If no argument: run `inspect`.

---

## Subcommand: `inspect` (no args)

Scan all migration files and produce a summary report.

1. **List all migrations**:
   ```bash
   cd next-app && ls -1 drizzle/migrations/*.sql | sort
   ```

2. **For each `.sql` file**, extract:
   - The journal entry (`idx`, `tag`, `when`) from `drizzle/migrations/meta/_journal.json`
   - Tables created (`CREATE TABLE`)
   - Columns added (`ALTER TABLE ... ADD COLUMN`)
   - Indexes created (`CREATE INDEX` / `CREATE UNIQUE INDEX`)
   - Constraints added (`ADD CONSTRAINT ... PRIMARY KEY | UNIQUE | FOREIGN KEY`)
   - Enums (`CREATE TYPE ... AS ENUM`)

3. **Scan for issues** using the `nextjs-saas-patterns` §5 patterns:
   - `ALTER COLUMN ... SET DATA TYPE` without an explicit `USING` cast (PG 42804 on a fresh DB)
   - Enum value changes that drop/rename in place (must recreate the type)
   - A `.sql` file present on disk but **missing from `_journal.json`** (won't apply)
   - `DROP COLUMN` / `DROP TABLE` / `DROP INDEX` (destructive — needs @dba sign-off)
   - FK columns with no covering index (lookup perf)

4. **Output format**:
   ```
   ## Migration Inventory (N files)

   | idx | tag | Tables | Columns | Indexes | Issues |
   |-----|-----|--------|---------|---------|--------|
   | 0000 | bright_mandarin | users, accounts, … | 12 | 2 | ✅ |
   | 0006 | spooky_rachel_grey | — | — | 9 | ✅ |
   ...

   ### Issues Found
   - 0005:14 — ALTER COLUMN TYPE without USING cast (will fail on fresh DB)
   ...

   ### Statistics
   - Total tables: N · columns added: N · indexes: N · enums: N
   - Clean migrations: N/M · journal entries: N
   ```

## Subcommand: `inspect NNNN`

Deep-inspect a single migration file.

1. **Read** `drizzle/migrations/NNNN_*.sql` (glob for the file matching the number).
2. **Show**: the full SQL with annotations (statement-breakpoint boundaries).
3. **Analyze**:
   - Every `CREATE TABLE` / `ADD COLUMN` — type, nullable, default, FK
   - Every `CREATE INDEX` — columns, uniqueness, whether it covers an FK
   - Every `ADD CONSTRAINT` — PK / UNIQUE / FK (and `ON DELETE` policy if present)
   - Any destructive or type-changing statement (flag for review)
4. **Lint check** against `nextjs-saas-patterns` §5 rules.
5. **Report** issues with exact line numbers and suggested fixes.

## Subcommand: `lint`

Scan migrations for risky patterns, then verify they apply cleanly to a fresh DB.

```bash
cd next-app && pnpm db:test-migrate   # drizzle/test-migrate.ts — applies ALL migrations
                                      # to a throwaway DB and asserts the tables exist
```

Also grep the `.sql` files for the §5 red flags (`ALTER COLUMN ... TYPE` without
`USING`, in-place enum edits, `DROP COLUMN|TABLE|INDEX`). If `pnpm db:test-migrate`
fails or a red flag fires, read the offending `.sql` and suggest exact fixes.

## Subcommand: `history`

Show the migration chain.

1. **Read** `drizzle/migrations/meta/_journal.json` — the ordered `entries[]`.
2. **Build** the chain: `0000 → 0001 → … → head` (idx order).
3. **Show** as a table:
   ```
   | idx | tag | When (UTC) | Tables touched |
   |-----|-----|------------|----------------|
   | 0000 | bright_mandarin | 2026-… | users, accounts, sessions, … |
   | 0006 | spooky_rachel_grey | 2026-… | composite PKs + UNIQUEs + indexes |
   ```
4. **Check** for gaps (a `.sql` on disk with no journal entry, or vice versa) and
   that the on-disk numbering is contiguous.

## Subcommand: `diagnose <error>`

Analyze a migration/DB error message and suggest a fix.

1. **Parse** the error text from `$ARGUMENTS` (everything after "diagnose").
2. **Match** against known patterns (from `nextjs-saas-patterns` §5):

   | Error pattern | Cause | Fix |
   |--------------|-------|-----|
   | `42804 ... cannot be cast automatically to type integer` | `ALTER COLUMN ... SET DATA TYPE` from timestamp/text without a cast | Add `USING extract(epoch from "<col>")::integer` (or the right `USING` expr) |
   | `cannot drop ... because other objects depend on it` (enum) | Editing a `pgEnum`'s values in place | Recreate the type: drop default → cast column to `text` → drop old enum → create new enum → cast back with `USING CASE …` → restore default |
   | `relation "X" already exists` | Migration already applied, or a re-run | Check `_journal.json` + the DB's `__drizzle_migrations` table |
   | `column "X" does not exist` | Schema edited but no migration generated | Run `pnpm db:generate` then `pnpm db:migrate` |
   | migration `.sql` ignored / not applied | File not registered in `_journal.json` | Regenerate via `pnpm db:generate`, or add the journal entry |
   | `DATABASE_URL` undefined at generate/migrate | drizzle-kit / tsx don't read `.env.local` | Source the env first (see the `make local-db` target / Makefile) |

3. **If error matches**: show the fix with exact SQL/TS.
4. **If no match**: read the recent `.sql` files + the schema and diagnose from the traceback.

## Subcommand: `fix NNNN`

Propose fixes for risky patterns in a specific migration file.

1. **Read** the migration `.sql`.
2. **Find** violations (`ALTER COLUMN TYPE` without `USING`, in-place enum edits,
   unguarded destructive statements).
3. **Show** proposed changes as a diff.
4. **Apply** fixes using the Edit tool — and if the schema is the real source of the
   change, fix `lib/schema/*.ts` and regenerate rather than hand-patching SQL.
5. **Verify** with the fresh-DB apply:
   ```bash
   cd next-app && pnpm db:test-migrate
   ```

## Subcommand: `status`

Quick health check of the migration system.

1. **Drift check** (schema vs. migrations):
   ```bash
   cd next-app && npx drizzle-kit check
   ```
2. **Journal head**: read the last entry of `drizzle/migrations/meta/_journal.json`.
3. **Fresh-DB apply**:
   ```bash
   cd next-app && pnpm db:test-migrate
   ```
4. **Report** in one block:
   ```
   ## DBA Status
   - Journal head: 0006 (spooky_rachel_grey)
   - Drift (drizzle-kit check): clean ✅ / N collisions
   - Fresh-DB apply (db:test-migrate): pass ✅
   - Pending schema changes: run `pnpm db:generate` to see if a new migration is due
   ```

## Subcommand: `new <description>`

Generate a new migration with safety checks.

1. **Pre-check**: the schema edit landed in `lib/schema/*.ts` and is re-exported by
   `lib/schema/index.ts` (drizzle.config reads the barrel).
2. **Generate**:
   ```bash
   cd next-app && pnpm db:generate   # drizzle-kit generate — diffs schema → new NNNN_*.sql + updates _journal.json
   ```
3. **Read** the generated `.sql`.
4. **Lint** it (§5 red flags) and verify it applies:
   ```bash
   cd next-app && pnpm db:test-migrate
   ```
5. **Show** the generated migration for review.
6. **Suggest** applying with `pnpm db:migrate` (and re-seeding via `pnpm db:seed` if needed).

## Subcommand: `review <rev>` (E157)

Ad-hoc migration review. Drizzle migrations are already plain `.sql`, so there is no
"emit offline SQL" step — read the file directly, scan for red flags, and on a hit
auto-delegate to the `@dba` agent for sign-off. This is the manual entry point to the
same path `@qa` takes automatically when `drizzle/migrations/` changed in the PR.

1. **Resolve** `<rev>` from `$ARGUMENTS` (a migration number like `0006`, or `head`
   = the last journal entry).
2. **Read** the migration `.sql` (and, if a downgrade exists, it; otherwise note that
   Drizzle has none and a reverse plan must be authored).
3. **Scan** for red flags: `DROP COLUMN`, `DROP TABLE`, `DROP INDEX`,
   `ALTER COLUMN ... TYPE`, in-place enum edits.
4. **If red flags fired** — spawn the `@dba` agent with:
   - The migration `.sql` path
   - The red-flag summary
   - The instruction: "Write `docs/context/migration-review/<rev>-signoff.md` per the
     template in `.claude/agents/dba.md`. Decide GO or NOGO and provide a concrete
     reverse-SQL rollback plan (Drizzle has no auto-downgrade)."
5. **If no red flags** — print "No red flags. Sign-off optional." and exit.
6. **Always** show a summary table at the end:
   ```
   ## Migration Review — <rev>
   - Migration:  drizzle/migrations/<rev>_*.sql
   - Red flags:  N
   - Sign-off:   docs/context/migration-review/<rev>-signoff.md (or "not required")
   - Decision:   GO | NOGO | not required
   ```
