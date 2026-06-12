# E127 — Pre-Commit Config + FK Naming Rule

## Goal
Add `.pre-commit-config.yaml` to automate code quality checks, and a 6th migration linter rule requiring explicit `name=` on all ForeignKey constraints.

## Design

### `.pre-commit-config.yaml`
- `pre-commit-hooks`: trailing-whitespace, end-of-file-fixer
- `astral-sh/ruff-pre-commit`: ruff check + ruff format
- Local hook: migration linter (`uv run pytest tests/test_migration_lint.py`) triggered on `server/alembic/versions/*.py`

### 6th Linter Rule: `test_explicit_fk_constraint_names`
- Scan migration files for `ForeignKey(` and `ForeignKeyConstraint(` calls
- Assert each has an explicit `name=` parameter
- Supports existing `# noqa: migration-lint` inline suppression
- Existing migrations get `# noqa: migration-lint` for pre-existing unnamed FKs

## Files Changed
- `.pre-commit-config.yaml` (new)
- `server/tests/test_migration_lint.py` (add 6th test)
- `server/alembic/versions/001_auth.py` (add noqa for existing unnamed FKs)
