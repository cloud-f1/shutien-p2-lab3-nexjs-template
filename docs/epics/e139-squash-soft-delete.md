# E139 — Migration Squash Guide + Soft Delete Mixin [M, 5 SP]

## Goal
Provide a squashing guide for Alembic migrations and a reusable `SoftDeleteMixin` for models that need logical deletion instead of physical removal.

## Deliverables
1. `server/alembic/SQUASH_GUIDE.md` — step-by-step squashing procedure (~40 lines)
2. `server/app/models/mixins/soft_delete.py` — `SoftDeleteMixin` with `deleted_at`, `is_deleted`, `soft_delete()`, `restore()`
3. Update `server/app/models/mixins/__init__.py` — export `SoftDeleteMixin`
4. `server/tests/unit/test_soft_delete.py` — 6 unit tests covering all mixin behaviour

## Status
- [x] Spec
- [x] Implement
- [x] QA
- [x] Commit
