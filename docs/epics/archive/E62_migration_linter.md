# E62 — Migration Linter + Fix Existing Drift

> **Phase**: 20 — DBA Schema Management
> **Priority**: P0 | **Points**: 13
> **Depends on**: None (independent)
> **Source**: Migrated from ai-clock-work E90 — production migration best practices

---

## Problem Statement

Migration files may use `server_default="0"` for Boolean columns (breaks PostgreSQL, requires `sa.text("false")`), inconsistent UUID types (`sa.CHAR(36)`, `sa.String(36)` instead of `sa.Uuid()`), or missing FK `ondelete` policies. No automated check prevents future migrations from using banned patterns. These bugs pass CI because tests run against SQLite.

## Stories

### E62-S01: Audit + Fix Existing Migration Drift (3 pts)

**Task**: Scan all 9 migrations (001–008) for banned patterns and fix any violations:
- `sa.CHAR(36)` / `sa.String(36)` for UUID columns → `sa.Uuid()`
- `server_default="0"` / `"1"` on Boolean columns → `sa.text("false")` / `sa.text("true")`
- `server_default="false"` (string literal) → `sa.text("false")`

**Note**: Duplicate `006_` files exist — verify chain integrity.

**Acceptance Criteria**:
- Given all existing migration files
- When I inspect Boolean column definitions
- Then all use `server_default=sa.text("false")` or `sa.text("true")`
- And all UUID columns use `sa.Uuid()`
- And `alembic upgrade head` succeeds on a fresh PostgreSQL database

### E62-S02: Migration Linter Test Suite (5 pts)

**Task**: Create `server/tests/test_migration_lint.py` — a pytest file that scans all `.py` files in `server/alembic/versions/` for banned patterns.

**Banned Patterns**:
1. `sa.CHAR(36)` — must use `sa.Uuid()` for UUID columns
2. `sa.String(36)` — must use `sa.Uuid()` for UUID columns
3. `server_default="0"` on Boolean columns — must use `sa.text("false")`
4. `server_default="1"` on Boolean columns — must use `sa.text("true")`

**Note**: `sa.Uuid()` is the correct type for migrations. The project's `GUID` TypeDecorator is for models only — it provides process_bind_param/process_result_value logic that Alembic doesn't need.

**Acceptance Criteria**:
- Given a migration file with `sa.CHAR(36)` or `sa.String(36)`
- When the linter test runs
- Then it fails with a clear message: "Migration {file} uses sa.CHAR(36) — use sa.Uuid() instead"
- And the linter passes for all existing (fixed) migrations
- And `pytest tests/test_migration_lint.py` runs in < 2 seconds

### E62-S03: Documentation + CI Integration (5 pts)

**Task**: Add migration writing guidelines to the `server-patterns.md` skill. Update the linter to also check for:
- Missing `ondelete` policy on ForeignKey constraints
- Numeric `server_default="0"` on Integer columns (warn, suggest `sa.text("0")`)

**Acceptance Criteria**:
- Given `server-patterns.md`
- When I read the Alembic Migrations section
- Then it documents correct UUID type (`sa.Uuid()`), Boolean defaults (`sa.text("false")`), and FK ondelete policies
- And the migration linter test is included in the standard `pytest` run
- And all existing migrations pass the linter

## Risk Notes

- **Low risk**: Only modifies migration files (already applied to DB) and adds a test file
- **Existing test_migrations.py**: Already has 3 structural tests — linter adds pattern-level checks alongside
- **False positives**: The linter should skip comment lines and string literals

## Dependency Chain

```
E62-S01 (fix drift) → E62-S02 (linter validates fixes) → E62-S03 (docs + CI)
```
