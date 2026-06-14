# Testing

The @saas template ships with a two-tier test suite:

| Tier | Tool | Coverage Gate | Scope |
|------|------|--------------|-------|
| Unit | Vitest | ≥ 80% | `lib/`, `actions/`, validations |
| E2E | Playwright | N/A (smoke gate) | Auth flows, dashboard, admin |

## Running Tests

All commands run from `next-app/`:

```bash
# Unit tests
pnpm test              # run all unit tests
pnpm test:coverage     # with v8 coverage report

# E2E tests
pnpm db:seed           # required — seeds test users
pnpm test:e2e          # Playwright (auto-boots dev server)
```

## Unit Tests

Unit tests live alongside source files in `__tests__/` directories or as `*.test.ts` files.

Powered by **Vitest** with:
- `@testing-library/react` for component rendering
- `msw` for API mocking (handlers in `src/tests/handlers/`)
- `userEvent` (not `fireEvent`) for interaction

```ts
// Example: testing a server action
import { describe, it, expect, vi } from 'vitest'
import { updateProfile } from '@/actions/account'

describe('updateProfile', () => {
  it('updates name and returns success', async () => {
    // Mock the DB call
    vi.mock('@/lib/db', () => ({ db: mockDb }))
    const result = await updateProfile({ name: 'Alice' })
    expect(result.success).toBe(true)
  })
})
```

## E2E Tests

E2E tests live in `next-app/e2e/` and use Playwright.

```bash
# Run all e2e tests
pnpm test:e2e

# Run a specific spec
pnpm test:e2e --grep "dashboard"
```

Default test accounts (after `pnpm db:seed`):
- `admin@example.com` / `Admin123!`
- `user@example.com` / `User123!`

## Coverage Gate

The 80% coverage gate is enforced by the QA agent (`/athena:qa`). It runs
`pnpm test:coverage` and blocks merge if coverage drops below threshold.

```bash
# Check coverage manually
pnpm test:coverage
# Look for: Statements: ≥ 80%
```
