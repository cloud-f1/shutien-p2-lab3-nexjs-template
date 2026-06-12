---
description: "(ops) Database admin → inspect migrations → lint SQL → diagnose errors → fix suggestions."
allowed-tools: Read, Bash, Grep, Glob, Edit, Write
---

# /athena:dba — Database Administration Command

Inspect, lint, and manage Alembic migration files. Subcommand-driven.

## Parse Arguments

Parse `$ARGUMENTS` for the subcommand:

| Subcommand | Action |
|------------|--------|
| `inspect` (default) | Read and summarize all migration files |
| `inspect NNN` | Deep-inspect a specific migration (e.g., `inspect 005`) |
| `lint` | Run migration linter + report violations |
| `history` | Show migration chain with dependencies |
| `diagnose <error>` | Analyze a migration error and suggest fix |
| `fix NNN` | Auto-fix banned patterns in migration NNN |
| `status` | Current head + pending changes + linter status |
| `new <description>` | Generate migration with autogenerate + lint + review |
| `review <rev>` | Emit offline SQL for `<rev>`, scan red flags, delegate to @dba on hit (E157) |

If no argument: run `inspect`.

---

## Subcommand: `inspect` (no args)

Scan all migration files and produce a summary report.

1. **List all migrations**:
   ```bash
   cd server && ls -1 alembic/versions/*.py | sort
   ```

2. **For each migration file**, extract:
   - Revision ID and down_revision (dependency chain)
   - Tables created (`op.create_table`)
   - Columns added (`op.add_column`)
   - Indexes created (`op.create_index`)
   - Constraints added (`UniqueConstraint`, `ForeignKey`)

3. **Scan for issues** using the DBA skill patterns:
   - `sa.CHAR(36)` or `sa.String(36)` (should be `sa.Uuid()`)
   - `server_default="0"` or `"1"` on Boolean columns
   - `ForeignKey` without `ondelete`
   - Missing downgrade functions

4. **Output format**:
   ```
   ## Migration Inventory (N files)

   | # | Tables | Columns | Indexes | Issues |
   |---|--------|---------|---------|--------|
   | 001 | user, oauth_account | 12 | 2 | ✅ |
   | 002 | sessions | 6 | 1 | ✅ |
   ...

   ### Issues Found
   - 006:20 — Boolean server_default needs sa.text()
   ...

   ### Statistics
   - Total tables created: N
   - Total columns added: N
   - Total indexes: N
   - Clean migrations: N/M
   ```

## Subcommand: `inspect NNN`

Deep-inspect a single migration file.

1. **Read** `server/alembic/versions/NNN_*.py` (glob for the file matching the number)
2. **Show**: full upgrade() content with annotations
3. **Analyze**:
   - Every `sa.Column` call — type, nullable, default, FK
   - Every `op.create_index` — columns, uniqueness
   - Every `ForeignKey` — ondelete policy
   - Downgrade completeness (does it undo everything?)
4. **Lint check** against DBA skill rules
5. **Report** issues with exact line numbers and suggested fixes

## Subcommand: `lint`

Run the migration linter and report results.

```bash
cd server && uv run pytest tests/test_migration_lint.py -v
```

If failures found, read the failing migration files and suggest exact fixes.

## Subcommand: `history`

Show the migration dependency chain.

1. **Read** all migration files, extract `revision` and `down_revision`
2. **Build** the chain: `base → 001 → 002 → ... → head`
3. **Show** as a table:
   ```
   | Rev | Description | Tables | Down |
   |-----|-------------|--------|------|
   | 001 | fastapi_users_initial | user, oauth_account | base |
   | 002 | add_sessions_table | sessions | 001 |
   ...
   ```
4. **Check** for gaps, branches, or broken chain links

## Subcommand: `diagnose <error>`

Analyze a migration error message and suggest a fix.

1. **Parse** the error text from `$ARGUMENTS` (everything after "diagnose")
2. **Match** against known error patterns:

   | Error pattern | Cause | Fix |
   |--------------|-------|-----|
   | `DatatypeMismatchError: character and uuid` | `sa.CHAR(36)` FK → `uuid` PK | Change FK column to `sa.Uuid()` |
   | `DatatypeMismatchError: boolean but default...integer` | `server_default="0"` on Boolean | Change to `sa.text("false")` |
   | `UndefinedColumnError: column X does not exist` | Model column not migrated | Run `--autogenerate` |
   | `UndefinedTableError` | Table not created yet | Check migration order |
   | `DuplicateTableError` | Table already exists | Check if migration already applied |
   | `constraint...does not exist` | Downgrade references non-existent constraint | Use `try/except` in downgrade |

3. **If error matches**: show the fix with exact code
4. **If no match**: read recent migration files and the error traceback to diagnose

## Subcommand: `fix NNN`

Auto-fix banned patterns in a specific migration file.

1. **Read** the migration file
2. **Find** all violations (CHAR(36), bad Boolean defaults, missing ondelete)
3. **Show** proposed changes as a diff
4. **Apply** fixes using Edit tool
5. **Run linter** to verify fixes:
   ```bash
   cd server && uv run pytest tests/test_migration_lint.py -v
   ```

## Subcommand: `status`

Quick health check of the migration system.

1. **Current head**:
   ```bash
   cd server && uv run python -m alembic current
   ```
2. **Pending changes**:
   ```bash
   cd server && uv run python -m alembic check 2>&1
   ```
3. **Linter**:
   ```bash
   cd server && uv run pytest tests/test_migration_lint.py -v
   ```
4. **Report** in one block:
   ```
   ## DBA Status
   - Head: 008
   - Pending model changes: none
   - Linter: N/N pass ✅
   - PG smoke test: run `make test-migrations` to verify
   ```

## Subcommand: `new <description>`

Generate a new migration with full safety checks.

1. **Pre-check**: verify model imports in `server/app/models/__init__.py`
2. **Generate**:
   ```bash
   cd server && uv run python -m alembic revision --autogenerate -m "<description>"
   ```
3. **Read** the generated file
4. **Lint** it:
   ```bash
   cd server && uv run pytest tests/test_migration_lint.py -v
   ```
5. **Show** the generated migration content for review
6. **Suggest** applying with `uv run python -m alembic upgrade head`

## Subcommand: `review <rev>` (E157)

Ad-hoc migration review. Emits offline SQL, scans for red flags, and on
red-flag hit auto-delegates to the `@dba` agent for sign-off. This is the
manual entry point to the same path that `@qa` Phase 2.6 takes
automatically when alembic versions changed in the PR.

1. **Parse** `<rev>` from `$ARGUMENTS` (defaults to `head` if omitted).
2. **Run the review script**:
   ```bash
   scripts/migration-review.sh "<rev>"
   ```
   This writes:
   - `docs/context/migration-review/<rev>-<ts>-upgrade.sql`
   - `docs/context/migration-review/<rev>-<ts>-downgrade.sql`
   And prints any red flags (`DROP COLUMN`, `DROP TABLE`, `DROP INDEX`,
   `ALTER COLUMN ... TYPE`) to stderr.
3. **If red flags fired** — spawn the `@dba` agent with:
   - The generated SQL artifact paths
   - The red-flag stderr summary
   - The instruction: "Write
     `docs/context/migration-review/<rev>-signoff.md` per the template in
     `.claude/agents/dba.md`. Decide GO or NOGO and provide a concrete
     rollback plan."
4. **If no red flags** — print "No red flags. Sign-off optional." and
   exit. The SQL artifacts are still written and version-controlled.
5. **Always** show a summary table at the end:
   ```
   ## Migration Review — <rev>
   - Upgrade SQL:   docs/context/migration-review/<rev>-<ts>-upgrade.sql
   - Downgrade SQL: docs/context/migration-review/<rev>-<ts>-downgrade.sql
   - Red flags:     N
   - Sign-off:      docs/context/migration-review/<rev>-signoff.md (or "not required")
   - Decision:      GO | NOGO | not required
   ```
