---
name: drizzle-migration-safety
description: >-
  Migration safety checklist for THIS Drizzle ORM + Postgres (postgres-js) template. Use when
  running /athena:dba, reviewing a PR that touches `next-app/lib/schema/*` or
  `next-app/drizzle/migrations/*.sql`, generating a new migration (`pnpm db:generate`), planning
  a column rename/type change/backfill, or diagnosing a migration failure. Encodes: destructive-
  change detection, the expand-migrate-contract pattern for safe renames, this repo's real
  commands (db:generate/db:migrate/db:test-migrate), backup-before-prod-migrate, and the fact
  Drizzle has no down-migrations (revert-forward only).
---

# Drizzle Migration Safety — AI-Coding-Template

Schema source of truth: `next-app/lib/schema/index.ts` (barrel) → `drizzle-kit generate` diffs it
against `next-app/drizzle/migrations/*.sql` + `meta/_journal.json`. Config: `next-app/drizzle.config.ts`.

## 1. The real commands (from `next-app/package.json`)

```bash
pnpm db:generate       # drizzle-kit generate — diffs lib/schema/* against migrations/, writes new .sql
pnpm db:migrate        # drizzle-kit migrate — applies pending migrations to $DATABASE_URL
pnpm db:test-migrate   # tsx drizzle/test-migrate.ts — fresh-DB validation (see §3)
pnpm db:studio         # drizzle-kit studio — visual browser
pnpm db:seed           # tsx drizzle/seed.ts — dev-only demo data (refuses in production)
```

`drizzle-kit check` (run via `pnpm exec drizzle-kit check` from `next-app/`) detects drift between
the migration history and the current schema file — run it when a migration was hand-edited or
when `meta/_journal.json` might be out of sync.

## 2. Destructive-change detection — stop and review

When `pnpm db:generate` produces a migration containing any of these, **stop and get human sign-off
before running `db:migrate` against a real database** — these are irreversible or lock-heavy:

- `DROP COLUMN` / `DROP TABLE` — data loss, no Drizzle down-migration to undo it (see §4).
- `ALTER TABLE ... RENAME COLUMN` / `RENAME TO` — drizzle-kit sometimes infers a rename as
  drop+add instead of a true rename depending on how the schema diff reads; always open the
  generated `.sql` and confirm it says `RENAME`, not `DROP` + `ADD` (which silently loses data
  in existing rows).
- `ALTER COLUMN ... TYPE` — narrowing a type (e.g. `text` → `varchar(50)`) can truncate/reject
  existing data; widening is usually safe but still triggers a table rewrite on large tables.
- `ALTER COLUMN ... SET NOT NULL` without first backfilling every existing row — the migration
  fails outright if any row is currently `NULL` in that column. This repo already hit the
  companion trap once: an `ALTER COLUMN ... SET DATA TYPE integer` from a `timestamp` needed an
  explicit `USING extract(epoch from "expires_at")::integer` cast (Postgres error 42804 otherwise)
  — see `.claude/skills/nextjs-saas-patterns/SKILL.md` §5.
- Enum value removal — Postgres enums can't drop a value in place. The repo's own precedent
  (same skill, §5) is: drop default → cast column to `text` → drop old enum → create new enum →
  cast back with `USING CASE ... END` mapping → restore default. Verify on both a populated dev DB
  and a fresh DB (exactly what `db:test-migrate` automates — see §3).

## 3. `pnpm db:test-migrate` — what it actually does

Read `next-app/drizzle/test-migrate.ts` before describing it secondhand — it is NOT the same
check as `db:migrate` on the dev DB:

- `pnpm db:migrate` (via `smoke.sh`) tolerates an **already-migrated** dev DB — "already exists"
  is treated as SKIP. A migration broken only on a truly fresh DB slips through that path.
- `db:test-migrate` spins up a **brand-new, empty** throwaway database
  (`saas_migrate_test_<pid>`, created against the `postgres` maintenance DB derived from
  `$DATABASE_URL`), runs `drizzle-kit migrate` against **only** that DB, then asserts:
  1. every table in its hardcoded `EXPECTED` list exists (`users`, `accounts`, `sessions`,
     `verification_tokens`, `email_verification_tokens`, `password_reset_tokens`, `items`,
     `plans`, `subscriptions`, `payment_events`, `usage_events`, `api_keys`, `webhooks`,
     `webhook_deliveries`, `audit_log`, `invitations`, `notifications`),
  2. `drizzle.__drizzle_migrations` has at least one tracked row (proves Drizzle actually recorded
     the migration, not just that the SQL happened to apply).
- It drops the throwaway DB in a `finally` (best-effort cleanup) either way, so the dev DB is
  never touched.
- Exit codes: `0` = clean apply **or** SKIP (no Postgres reachable — this is intentional so CI/local
  runs without a DB don't fail the gate); `1` = migrate failed, or an expected table is missing.
- **When you add a new table**, add its name to the `EXPECTED` array in `test-migrate.ts` — this
  test will not catch a missing table it doesn't know to look for, and a stale list gives false
  confidence.
- Run it before `db:migrate` against anything that isn't your own throwaway dev DB, and definitely
  before a prod migration — it is the from-scratch guarantee `db:migrate` alone doesn't give you.

## 4. Rollback reality: Drizzle has no down migrations

There is no `drizzle-kit migrate:down`. The only way to "undo" a bad migration already applied to
a shared/prod DB is to **write and apply a new forward migration that reverses it** — e.g. a
dropped column comes back as a new `ADD COLUMN` migration (data is gone unless restored from
backup; see §6), a bad `NOT NULL` is reverted with a new `ALTER COLUMN ... DROP NOT NULL`
migration. Treat "rollback" as "roll forward with a corrective migration", and treat any migration
that would make that correction impossible (e.g. `DROP TABLE` on data with no backup) as the
highest-severity review item in this checklist.

## 5. Expand → Migrate → Contract — the pattern for renames/type changes

For anything riskier than an additive `ADD COLUMN` (renames, type changes, moving a column to a
new table), don't ship it as one migration. Split into three:

1. **Expand** — add the new column/table alongside the old one (purely additive migration, safe
   to apply with zero downtime). Both old and new are live; application code still reads/writes
   the old one.
2. **Migrate (backfill)** — an idempotent script (see §6) copies/derives data from old → new for
   every existing row, in batches. Application code is updated to **write to both** (dual-write)
   or to read-prefer-new-fallback-old during this window.
3. **Contract** — once the backfill is verified complete and application code fully reads/writes
   only the new column, ship a final migration that drops the old column/table. This is the only
   step that's actually destructive, and by then it's provably safe because nothing reads the old
   column anymore.

Never collapse steps 1 and 3 into a single migration for a live table with real data — that's
exactly the `RENAME`-vs-`DROP`+`ADD` trap in §2.

## 6. Backfill SOP

- **Idempotent**: re-running the script twice must not double-apply or error — use
  `WHERE new_col IS NULL` (or an equivalent "not yet migrated" predicate) so a partial run can
  safely resume.
- **Batched**: update in chunks (e.g. `LIMIT 1000` loops keyed on id, or a `WHERE id > $lastId
  ORDER BY id LIMIT 1000` cursor) rather than one giant `UPDATE ... WHERE 1=1` — a single
  unbounded `UPDATE` on a large table holds a long-lived lock and can block reads/writes for the
  duration.
- **Progress-observable**: log rows-updated per batch so a stuck/slow backfill is diagnosable
  without guessing.
- Write backfill scripts as one-off `tsx` scripts (same pattern as `drizzle/seed.ts` — imports
  `db` from `lib/db.ts`, runs, exits), not as a migration's raw SQL — migrations should stay pure
  schema DDL; data transformation belongs in application-level scripts so it can use real
  TypeScript logic and be tested.

## 7. Backup before a production migration

This repo's backup tooling (`scripts/db-backup.sh`, run via `make db-backup`) is Docker-Compose-
local only — it does `docker exec <postgres container> pg_dump -U $POSTGRES_USER $POSTGRES_DB |
gzip` into `backups/`. It does **not** target a remote prod DB. For any migration against a real
staging/prod database (Zeabur-hosted Postgres, Cloud SQL, etc.), take an explicit backup first
with a direct `pg_dump`:

```bash
pg_dump "$DATABASE_URL" | gzip > "backup_$(date +%Y-%m-%d_%H%M%S).sql.gz"
```

or the platform's native snapshot (Cloud SQL automated backups / on-demand export; Zeabur's
managed Postgres backup, if enabled). Confirm the backup completed and is restorable-in-principle
**before** running `pnpm db:migrate` with a prod `DATABASE_URL` — this is a manual gate, nothing in
this repo automates it today. If your fork migrates prod frequently, consider wrapping this into a
`db:backup-remote` script rather than relying on someone remembering the one-liner.

## 8. Migration review checklist for PRs touching `next-app/drizzle/` or `lib/schema/*`

- [ ] Migration generated via `pnpm db:generate` (not hand-written) unless there's a documented
      reason (e.g. a cast Drizzle can't infer — see the `expires_at` precedent in §2); hand-edits
      must also update `drizzle/migrations/meta/_journal.json` or `drizzle-kit migrate` won't
      pick the file up (`nextjs-saas-patterns` skill §5).
- [ ] `pnpm db:test-migrate` passes against a fresh DB (§3) — not just `db:migrate` against an
      already-migrated dev DB.
- [ ] Any `DROP`/`RENAME`/type-narrowing change reviewed under §2 and, if the table has real data,
      split per the expand-migrate-contract pattern (§5) rather than shipped as one migration.
- [ ] **Lock risk on large tables** — does this migration take an `ACCESS EXCLUSIVE` lock for
      longer than a moment on a table with meaningful row count? Adding a column with a
      **non-null default** rewrites the whole table pre-Postgres-11-semantics; on modern Postgris
      (11+) a constant default is fast (metadata-only), but a `DEFAULT` computed per-row, or
      adding an index without `CONCURRENTLY`, still locks/rewrites. Flag `CREATE INDEX` without
      `CONCURRENTLY` on a table expected to have production traffic.
- [ ] `NOT NULL` added to an existing column — confirm the accompanying backfill runs (§6)
      *before* this migration in the ordered migration sequence, not after, or the migration
      itself fails on the first NULL row it finds.
- [ ] New table added to `EXPECTED` in `next-app/drizzle/test-migrate.ts` (§3) if this migration
      creates one.
- [ ] Backup taken (§7) before applying to any shared/staging/prod database — not just local dev.
