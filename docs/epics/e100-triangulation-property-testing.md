# E100 — Triangulation & Property-Based Testing

> **Phase 28** | Priority: P1 | Points: 8 | Size: M
> **Depends on**: E97

---

## Problem Statement

Existing server tests use single-case assertions — one test function per scenario with hardcoded values. This pattern is fragile: it can pass with a hardcoded return value (the "return 5" anti-pattern from test-master.md's Triangulation principle). No tests use `@pytest.mark.parametrize` or `hypothesis` for property-based testing.

The project already has `factory-boy>=3.3.1` and `faker>=33.3.1` in dev dependencies but they are unused — no test data factories exist.

## Stories

### S1: Test Data Factories

**AC:**
- [ ] `server/tests/factories.py` created with factory-boy factories:
  - `UserFactory` — generates valid User instances with faker data
  - `OAuthAccountFactory` — generates OAuth account records
- [ ] Factories use project's GUID type correctly (uuid.UUID, not str)
- [ ] Factories registered with async session via `factory.alchemy.SQLAlchemyModelFactory`
- [ ] Existing tests can optionally use factories (no forced migration)

### S2: Parametrize Existing Auth Tests

**AC:**
- [ ] `test_auth_register.py` — parametrize validation error cases (missing email, short password, invalid format)
- [ ] `test_auth_login.py` — parametrize failure cases (wrong password, nonexistent user, empty body)
- [ ] `test_auth_edge_cases.py` — parametrize bad JWT formats and invalid email patterns
- [ ] Net test count stays same or increases (parametrize replaces N functions with 1 parametrized function + N cases)
- [ ] All tests still pass

### S3: Hypothesis Property-Based Tests

**AC:**
- [ ] `hypothesis` added to dev dependencies in `pyproject.toml`
- [ ] `server/tests/unit/test_properties.py` with property-based tests for:
  - Config parsing: any valid comma-separated string produces a list (ALLOWED_ORIGINS)
  - UUID round-trip: any UUID stored via GUID TypeDecorator roundtrips correctly
  - Email validation: hypothesis-generated strings test email validation boundaries
- [ ] `hypothesis` profile configured in conftest (deadline, max_examples for CI)

### S4: Client Parametrize Template

**AC:**
- [ ] Document `it.each` pattern in testing skill for client tests
- [ ] Add one example in existing client test file using `it.each` (if client tests exist by then)
- [ ] Template pattern in skill for future client parametrize usage

## Risk Notes

- factory-boy + async SQLAlchemy requires careful session binding — test with existing conftest `db` fixture
- hypothesis can be slow with large example counts — set `max_examples=50` for CI, `200` for local
- Depends on E97 (skill must define parametrize patterns before this epic applies them)

## Files to Touch

```
server/tests/factories.py                    — new: factory-boy factories
server/tests/integration/test_auth_register.py — update: add parametrize
server/tests/integration/test_auth_login.py    — update: add parametrize
server/tests/integration/test_auth_edge_cases.py — update: add parametrize
server/tests/unit/test_properties.py           — new: hypothesis tests
server/pyproject.toml                          — update: add hypothesis dep (factory-boy + faker already present)
```
