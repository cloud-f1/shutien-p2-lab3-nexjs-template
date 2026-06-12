# E103 — Dead Code Removal & Lifespan Cleanup

> **Phase 29** | Priority: P0 | Points: 5 | Size: S
> **Depends on**: none

---

## Problem Statement

The server's `main.py` lifespan still spawns a `cleanup_loop` from `app.tasks.session_cleanup` and references `SESSION_CLEANUP_INTERVAL_MINUTES` config. But session-based auth was removed in favor of stateless JWT (E0). This dead code runs on every server start — a maintenance trap and confusion source for template cloners who wonder what sessions table it's cleaning up.

## Stories

### S1: Remove Session Cleanup Dead Code

**AC:**
- [ ] `app/tasks/session_cleanup.py` deleted (or entire `tasks/` dir if empty after)
- [ ] `SESSION_CLEANUP_INTERVAL_MINUTES` removed from `config.py`
- [ ] `cleanup_loop` import and call removed from `main.py` lifespan
- [ ] No remaining references to session cleanup anywhere in codebase (grep verified)

### S2: Audit for Other Dead Imports/Config

**AC:**
- [ ] Scan `config.py` for any other unused config variables
- [ ] Scan `main.py` for unused imports
- [ ] Remove any dead code found
- [ ] All existing tests still pass after cleanup

### S3: Clean Lifespan Function

**AC:**
- [ ] `main.py` lifespan only contains real startup/shutdown logic
- [ ] Lifespan is well-commented for template cloners (what to add, what not to add)
- [ ] Server starts cleanly with no warnings about missing config

## Risk Notes

- Low risk — removing clearly dead code
- Must verify no test fixtures depend on the removed config/task

## Files to Touch

```
server/app/main.py                    — update: remove cleanup_loop from lifespan
server/app/core/config.py             — update: remove SESSION_CLEANUP_INTERVAL_MINUTES
server/app/tasks/session_cleanup.py   — delete: dead code
server/app/tasks/__init__.py          — update or delete: if empty
```
