# E138 — Advisory Locks Utility

**Status:** done
**Size:** S (3 SP)

## Goal
Provide async context managers for PostgreSQL advisory locks — exclusive access to critical sections like webhook deduplication and scheduled job execution.

## Scope
1. `server/app/db/advisory_locks.py` — `pg_advisory_lock` (blocking), `pg_try_advisory_lock` (non-blocking), `pg_advisory_unlock`
2. `_string_to_lock_key` helper to convert strings to 64-bit lock keys
3. Unit tests with mocked `AsyncSession` (SQLite test suite can't run real PG locks)

## Out of Scope
- Session-level vs transaction-level lock variants
- Redis-based distributed locks
