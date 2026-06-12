# E125 — PG Migration Round-Trip Script

**Size:** S (3 SP)  
**Status:** done

## Goal

Standalone Docker-based script that verifies Alembic migrations (upgrade → downgrade → upgrade) against a real disposable PostgreSQL 16 container — no pre-existing infra required.

## Technical Design

1. **`scripts/verify-pg-migrations.sh`** — self-contained bash script:
   - Spin up PG 16 container on random port (`--publish 127.0.0.1:0:5432` + inspect)
   - Unique container name: `pg-migration-test-<PID>` to avoid collisions
   - `trap` on EXIT to guarantee teardown
   - `pg_isready` polling loop (max 30s)
   - Three alembic steps: `upgrade head` → `downgrade base` → `upgrade head`
   - Capture exit codes; color PASS/FAIL output
   - Exit 0 on full success, 1 on any failure

2. **Makefile target** `verify-migrations` — delegates to the script

## Dependencies

- Docker CLI available
- `server/` with `uv sync` completed (alembic + app importable)
- No compose profiles, no external DB needed
