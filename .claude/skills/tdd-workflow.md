---
name: tdd-workflow
description: >
  Test-driven development workflow and testing principles for this project.
  Use when implementing features from specs, writing new tests, doing RED-GREEN-REFACTOR
  cycles, debugging test failures, choosing mocking strategy, reviewing test quality,
  or when someone asks about testing philosophy, architecture testability, or coverage.
  Covers unit tests (Vitest) and e2e (Playwright) with 10 codified testing principles.
---

# TDD Workflow & Testing Principles

## The Cycle: RED -> GREEN -> REFACTOR

1. **RED** — Write a failing test that defines expected behavior
2. **GREEN** — Write minimum code to make the test pass
3. **REFACTOR** — Clean up without changing behavior, re-run tests

DO NOT write implementation code before the test exists and fails.

**Coverage gate**: Unit `cd next-app && pnpm test -- --coverage` (target 80%) | E2E `cd next-app && pnpm test:e2e` (all scenarios must pass)

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

Use multiple cases to force general logic; prefer `it.each` or `describe.each` in Vitest.

```typescript
it.each([
  ["valid@example.com", true],
  ["", false],
  ["no-at-sign", false],
])("validates email %s → %s", (email, valid) => {
  expect(validateEmail(email)).toBe(valid);
});
```

For Server Actions / Route Handlers: test with distinct inputs in separate `it()` blocks.

---

## Layer B: Testable Architecture

### P3. Humble Object

Keep framework glue thin; push logic into testable pure functions or service modules.

- **DO**: Server Actions delegate to pure business logic functions — unit-test those functions directly
- **DON'T**: Put business logic inside Route Handler bodies or Server Actions directly

### P4. Dependency Injection

In Next.js, inject dependencies via function arguments (not DI frameworks). Tests pass test doubles directly.

```typescript
// service.ts
export async function createUser(db: DrizzleDb, email: string) { ... }

// service.test.ts
const mockDb = { insert: vi.fn().mockResolvedValue([{ id: "1" }]) };
await createUser(mockDb as any, "test@example.com");
```

### P5. Wrappers

Wrap third-party services behind your own interface so they're mockable.

- **DO**: Adapter module (e.g., `lib/payment.ts`) — mock the module with `vi.mock()`
- **DON'T**: Call `stripe.charges.create()` directly in Server Actions or Route Handlers

---

## Layer C: Boundary Control

### P6. Contract Tests

Validate assumptions about external interfaces haven't drifted.

- **DO**: `satisfies z.ZodType<ApiType>` in client Zod schemas — compile-time contract
- **DO**: Validate OpenAPI spec matches actual response shapes in integration tests
- **DON'T**: Rely solely on mocks — they mask real API changes

### P7. Effective Mocking

Mock at system boundaries only; never mock your own core logic.

- **DO**: `vi.mock("@/lib/db")` (DB boundary), Playwright network intercept (e2e boundary)
- **DON'T**: Mock internal pure functions — test them directly with real inputs
- **DO**: Return realistic data matching actual Drizzle schema shapes
- **DON'T**: Mock Server Actions themselves — test the underlying logic functions they call

---

## Layer D: AI Agent Rules

### P8. Agent Test Guidelines

1. Test public behavior via rendered output (component) or return value (Server Action/service function)
2. Never `expect(mock).toHaveBeenCalled()` on internal logic — assert DOM or return values instead
3. Use `userEvent` (not `fireEvent`) for interaction tests
4. Use Playwright for auth flows and full page interactions — Vitest for unit/component logic
5. No pytest — all tests are TypeScript: Vitest for unit, Playwright for e2e

### P9. Parametrize Over Duplication

- **DO**: One `it.each` for input variants
- **DON'T**: Five near-identical `it()` blocks with one value changed
- Use `describe.each` for grouping related parametrized suites

### P10. Mock Boundaries, Not Internals

| Layer | Mock Target | Tool |
|-------|------------|------|
| DB (unit) | `@/lib/db` module | `vi.mock("@/lib/db")` |
| External API | Third-party SDK modules | `vi.mock("stripe")` etc. |
| Network (e2e) | HTTP requests | Playwright `page.route()` |
| Time | Timers / dates | `vi.useFakeTimers()` |

Never mock: Next.js router internals, Auth.js session internals, Drizzle query builder internals.

---

## What to Test / NOT to Test

**Server logic**: Happy path, auth guard (redirect/401), validation errors, not found, duplicate.
**Client components**: Loading, success render, error render, user interactions, empty state.
**Never**: Internal state, private methods, library internals, CSS class names, framework plumbing.

## Project Test Structure

`next-app/__tests__/` or co-located `*.test.ts(x)` (Vitest unit/component tests)
`next-app/e2e/` (Playwright e2e tests)
Key patterns: `vi.mock("@/lib/db")` for DB, `page.route()` for network intercept in e2e.
