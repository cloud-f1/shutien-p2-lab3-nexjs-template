# E154 — Domain-First Test Organization

> Phase 38 — Cross-Project Extraction | Size: M (5 SP) | Deps: none
> Source: ai-casino-shift test architecture

## Problem

Template currently organizes server tests as `tests/unit/` + `tests/integration/`. This works for small projects but breaks down with 3+ domains — test files multiply, related tests scatter across directories, and it's hard to assess test coverage per domain. Casino-shift has 113 test files across 9 categories because it outgrew the flat structure.

## Solution

Restructure the test directory to mirror server architecture:

```
server/tests/
  domains/          # Per-domain endpoint + schema tests
    billing/
    teams/
    places/
  services/         # Business logic tests
  integration/      # Cross-domain + auth + DB flows
  contract/         # OpenAPI schema validation (existing E99)
  regression/       # Bug regression tests (pairs with E148 bugfix-log)
  guardrails/       # Security + permission boundary tests
  smoke/            # Critical path quick tests
  conftest.py       # Shared fixtures
```

## Key Files

| File | Action |
|------|--------|
| `server/tests/domains/` | New — directory structure with __init__.py |
| `server/tests/services/` | New — directory structure |
| `server/tests/regression/` | New — directory structure |
| `server/tests/guardrails/` | New — directory structure |
| `server/tests/smoke/` | New — directory structure |
| `server/tests/conftest.py` | Update — add domain-aware fixtures |
| `docs/guides/en/quickstart.md` | Update — add test directory reference |
| `docs/epics/e154-domain-first-test-org.md` | New — this spec |

## Acceptance Criteria

1. New directory structure created with `__init__.py` files
2. Existing unit tests remain in `tests/unit/` (no forced migration)
3. `make new-domain NAME=x` updated to create `tests/domains/x/` with test template
4. `pytest.ini` / `pyproject.toml` markers updated: `unit`, `integration`, `smoke`, `regression`
5. `pytest tests/domains/billing/` runs only billing tests (path-based filtering works)
6. Testing guide updated with "when to use which directory" decision table
7. Existing test counts unchanged — no tests broken by restructure

## Design Notes

- This is opt-in — existing `unit/` and `integration/` tests stay where they are
- New domains created via `make new-domain` auto-get the new structure
- Casino-shift's `tests/guardrails/` directory is particularly valuable — permission boundary tests catch RBAC bugs early
- `tests/regression/` pairs naturally with E148 bugfix-log: every fix gets a regression test in this directory (soft dependency — E148 enhances E154 but isn't required)
