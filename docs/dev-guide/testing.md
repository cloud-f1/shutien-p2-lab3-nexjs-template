# Testing Guide

> For detailed server testing patterns, see [../techstack/server.md](../techstack/server.md).
> For client testing patterns, see [../techstack/client.md](../techstack/client.md).

## Server Tests (pytest)

```bash
cd server
pytest                                        # all tests
pytest --cov=app --cov-report=term-missing    # with coverage
pytest tests/integration/test_auth.py -v      # single file
pytest -k "test_register"                     # filter
```

Key config in `pyproject.toml`:
- `asyncio_mode = "auto"` -- no `@pytest.mark.asyncio` needed
- `concurrency = ["greenlet", "thread"]` -- required for accurate async coverage
- Test DB: SQLite + aiosqlite (fast, no Docker needed)

Current status: **56 tests, 97% coverage**

## Client Tests (Vitest + MSW)

```bash
cd client
pnpm run test:run          # one-shot
pnpm run test              # watch mode
pnpm run test:coverage     # coverage report
pnpm run typecheck         # TypeScript check
pnpm run test:e2e          # Playwright E2E
```

Key rules:
- Always use `userEvent` from `@testing-library/user-event` (default import, not `fireEvent`)
- MSW handlers in `src/tests/handlers/` -- not inline in test files
- `onUnhandledRequest: "error"` -- every network call needs a handler

## Coverage Gates

- Server: >= 80% (`pytest --cov-fail-under=80`)
- Client: >= 80% (`vitest --coverage`)
- Both gates block `/athena:deploy` if below threshold
- **Never** lower thresholds. **Never** comment out tests.

## Docker Testing

```bash
# Run server tests inside Docker (uses SQLite test DB)
docker compose exec server pytest --cov=app --cov-report=term-missing
```
