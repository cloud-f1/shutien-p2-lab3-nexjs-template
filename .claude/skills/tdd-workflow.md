---
name: tdd-workflow
description: >
  Test-driven development workflow and testing principles for this project.
  Use when implementing features from specs, writing new tests, doing RED-GREEN-REFACTOR
  cycles, debugging test failures, choosing mocking strategy, reviewing test quality,
  or when someone asks about testing philosophy, architecture testability, or coverage.
  Covers both server (pytest) and client (Vitest) with 10 codified testing principles.
---

# TDD Workflow & Testing Principles

## The Cycle: RED -> GREEN -> REFACTOR

1. **RED** — Write a failing test that defines expected behavior
2. **GREEN** — Write minimum code to make the test pass
3. **REFACTOR** — Clean up without changing behavior, re-run tests

DO NOT write implementation code before the test exists and fails.

**Coverage gate**: Server `pytest --cov=app --cov-fail-under=80` (target 90%) | Client `pnpm test:run -- --coverage` (target 80%)

---

## Layer A: Testing Philosophy

### P1. Test Behavior, Not Implementation

- **DO**: Assert on HTTP status codes, response body, DB state
- **DON'T**: `mock_service.create.assert_called_once()` — tests internal wiring
- **Litmus**: If you refactor internals but output stays the same, does the test still pass?

```python
# DO                                         # DON'T
response = await client.post("/users", ...)  # mock_user_service.create.assert_called_once()
assert response.status_code == 201           # ← tests implementation, not behavior
```

### P2. Triangulation

Use multiple cases to force general logic; prefer `@pytest.mark.parametrize`.

```python
@pytest.mark.parametrize("email,status", [
    ("valid@example.com", 201), ("", 422), ("no-at-sign", 422),
])
async def test_email_validation(client, email, status):
    resp = await client.post("/users", json={"email": email, ...})
    assert resp.status_code == status
```

Client: use `it.each` or separate `it()` blocks with distinct MSW responses.

---

## Layer B: Testable Architecture

### P3. Humble Object

Keep framework glue thin; push logic into testable services.

- **DO**: Routes delegate to service classes — test services directly for unit tests
- **DON'T**: Put business logic inside route handlers

### P4. Dependency Injection

Use FastAPI `Depends()` so tests swap real deps for fakes via `app.dependency_overrides`.

```python
# conftest.py — this project's 3-tier DI chain
app.dependency_overrides[get_db] = lambda: test_db_session
app.dependency_overrides[get_user_db] = lambda: test_user_db
app.dependency_overrides[get_user_manager] = lambda: test_user_manager
```

### P5. Wrappers

Wrap third-party services behind your own interface so they're mockable.

- **DO**: Adapter class (e.g., `PaymentGateway`) — mock the adapter
- **DON'T**: Call `stripe.Charge.create()` directly in business logic
- The auth client uses thin typed wrappers over `AuthResponse` (the OpenAPI-generated type) — no adapter or compose layer.

---

## Layer C: Boundary Control

### P6. Contract Tests

Validate assumptions about external interfaces haven't drifted.

- **DO**: `satisfies z.ZodType<ApiType>` in client Zod schemas — compile-time contract
- **DO**: Validate OpenAPI spec matches actual response shapes in integration tests
- **DON'T**: Rely solely on mocks — they mask real API changes

### P7. Effective Mocking

Mock at system boundaries only; never mock your own core logic.

- **DO**: Mock `get_db` (DB boundary), MSW handlers (network boundary)
- **DON'T**: Mock `UserService.create()` — use real service + test DB
- **DO**: Return realistic data matching actual contracts
- **DON'T**: `with patch("app.services.user_service.create")` — mocking internals

Client: MSW handlers in `client/src/tests/handlers/` with realistic payloads. Never mock React Query hooks or Axios internals.

---

## Layer D: AI Agent Rules

### P8. Agent Test Guidelines

1. Test public behavior via HTTP endpoints (server) or rendered output (client)
2. Never `assert_called` on internal methods — assert response/DOM instead
3. Use `userEvent` (not `fireEvent`) for client interaction tests
4. Place MSW handlers in `client/src/tests/handlers/` — never inline
5. No `@pytest.mark.asyncio` — `asyncio_mode = "auto"` handles it

### P9. Parametrize Over Duplication

- **DO**: One parametrized test for status codes across input variants
- **DON'T**: Five near-identical test functions with one value changed
- Client: `describe.each` / `it.each` or shared test utilities

### P10. Mock Boundaries, Not Internals

| Layer | Mock Target | Tool |
|-------|------------|------|
| Server DB | `get_db` / `get_user_db` / `get_user_manager` | conftest DI overrides |
| Server external | Third-party API wrappers | `pytest-mock` / `monkeypatch` |
| Client network | HTTP requests | MSW handlers (`http.get`, `http.post`) |
| Client time | Timers / dates | `vi.useFakeTimers()` |

Never mock: React Query internals, Axios interceptors, FastAPI middleware, SQLAlchemy internals.

---

## What to Test / NOT to Test

**Server**: Happy path, auth (401), validation (422), not found (404), duplicate (409).
**Client**: Loading, success render, error render, user interactions, empty state.
**Never**: Internal state, private methods, library internals, CSS class names, framework plumbing.

## Project Test Structure

`server/tests/unit/` (pure logic) | `server/tests/integration/` (full request + test DB)
`client/src/tests/handlers/` (MSW) | `client/src/pages/__tests__/` (page tests)
Key fixtures: `client` (AsyncClient), `db` (AsyncSession w/ rollback), `verified_user_token` (JWT).
