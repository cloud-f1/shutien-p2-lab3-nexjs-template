# E0: GUID TypeDecorator — Spec

> **Goal**: Unify UUID handling across all models so `UUIDMixin.id` returns `uuid.UUID` objects (not strings), matching fastapi-users' `GUID` format.

## Problem

- `UUIDMixin` uses `String(36)` + `default=lambda: str(uuid.uuid4())` → DB stores/returns `str`
- fastapi-users' `SQLAlchemyBaseUserTableUUID` uses internal `GUID` TypeDecorator → returns `uuid.UUID`
- When future models FK to `User.id`, the type mismatch (`str` vs `uuid.UUID`) breaks joins and comparisons

## Solution

1. Define `GUID` TypeDecorator in `app/models/base.py` (local copy — avoids circular import from fastapi-users)
2. Replace `String(36)` in `UUIDMixin` with `GUID`
3. Change default from `lambda: str(uuid.uuid4())` to `uuid.uuid4`

## Files to Change

| File | Change |
|------|--------|
| `server/app/models/base.py` | Add `GUID` class, update `UUIDMixin` |
| `server/tests/unit/test_schemas.py` | Verify `uuid.UUID` objects work in assertions |

## No Changes Needed

- `server/app/models/user.py` — already uses fastapi-users GUID via inheritance
- `server/app/schemas/user.py` — already typed `uuid.UUID` via `schemas.BaseUser[uuid.UUID]`
- `client/src/schemas/auth.ts` — already uses `z.string().uuid()`
- `docs/openapi.yaml` — no API contract change (UUIDs are already string format in JSON)

## Test Plan

- Existing tests must still pass (no API behavior change)
- Verify `UUIDMixin.id` returns `uuid.UUID` object, not `str`

## Acceptance Criteria

- [ ] `GUID` TypeDecorator defined in `base.py`
- [ ] `UUIDMixin.id` uses `GUID` type
- [ ] All existing tests pass
- [ ] No migration needed (CHAR(36) storage format unchanged for SQLite)
