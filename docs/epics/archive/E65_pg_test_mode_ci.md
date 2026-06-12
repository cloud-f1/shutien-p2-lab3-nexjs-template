# E65 — PostgreSQL Test Mode + Migration CI Gate

> **Phase**: 20 — DBA Schema Management
> **Priority**: P1 | **Points**: 11
> **Depends on**: E62 (linter), E63 (autogenerate hooks)
> **Source**: Migrated from ai-clock-work E93 — test DB is SQLite, PG-breaking defaults pass CI

---

## Problem Statement

All server tests run against SQLite (`sqlite+aiosqlite:///./test.db`). This means:
- Boolean `server_default="0"` passes (SQLite treats 0 as false)
- `sa.CHAR(36)` FK → `sa.Uuid()` PK passes (SQLite doesn't enforce FK types)
- UUID format differences are invisible

These bugs only surface when migrations run against PostgreSQL in production.

**Note**: `test_migrations.py` already has a `test_migration_round_trip` that skips without PG — this epic provides the Docker infrastructure to make it runnable.

## Stories

### E65-S01: Docker Compose Test Service (3 pts)

**Task**: Add a `test-db` service to `docker-compose.yml` — a lightweight PostgreSQL instance for running migration tests.

**Configuration**:
```yaml
test-db:
  image: postgres:16-alpine
  environment:
    POSTGRES_DB: test_db
    POSTGRES_USER: test
    POSTGRES_PASSWORD: test
  ports:
    - "5433:5432"  # Different port to avoid conflict with dev DB
  tmpfs:
    - /var/lib/postgresql/data  # RAM disk for speed
  profiles:
    - test  # Only starts when explicitly requested
```

**Acceptance Criteria**:
- Given `docker compose --profile test up test-db -d`
- When I connect to `postgresql://test:test@localhost:5433/test_db`
- Then a fresh PostgreSQL 16 database is available
- And it starts in < 3 seconds (tmpfs)
- And it doesn't conflict with the dev `db` service on port 5432

### E65-S02: Migration Smoke Test (5 pts)

**Task**: Create `server/tests/test_migration_smoke.py` — a test that runs the full Alembic migration chain against PostgreSQL.

**Test flow**:
1. Connect to the test-db PostgreSQL instance (skip if unavailable)
2. Run `alembic upgrade head` — all migrations must succeed
3. Run `alembic downgrade base` — all downgrades must succeed
4. Run `alembic upgrade head` again — verify idempotency

**Note**: The existing `test_migration_round_trip` in `test_migrations.py` does similar — consider consolidating or extending it.

**Acceptance Criteria**:
- Given a fresh PostgreSQL database
- When the migration smoke test runs
- Then all migrations apply successfully
- And all downgrades complete without errors
- And the test is marked `@pytest.mark.skipif` when `TEST_DATABASE_URL` doesn't point to PG
- And the test takes < 30 seconds total

### E65-S03: CI Pipeline Integration (3 pts)

**Task**: Add migration smoke test to the CI pipeline via Makefile target.

**Implementation**:
- Add `make test-migrations` target: starts test-db, waits for ready, runs smoke test, stops test-db
- Set `TEST_DATABASE_URL=postgresql+asyncpg://test:test@localhost:5433/test_db`

**Acceptance Criteria**:
- Given I run `make test-migrations`
- When Docker is available
- Then it starts the test DB, runs migration smoke tests, and reports pass/fail
- And it cleans up the test DB container after

## Risk Notes

- **Docker dependency**: Tests require Docker for PostgreSQL — skip gracefully without Docker
- **CI time**: Adds ~30s to CI pipeline (tmpfs PG is fast)
- **Port conflict**: Uses port 5433 to avoid conflicting with dev DB on 5432

## Dependency Chain

```
E62 (fixes existing drift) → E65-S01 (test DB) → E65-S02 (smoke test) → E65-S03 (CI)
```
