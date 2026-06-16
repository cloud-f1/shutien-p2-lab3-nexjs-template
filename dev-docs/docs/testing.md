# Testing

The template ships with a two-tier test suite:

| Tier | Tool | Coverage Gate | Scope |
|------|------|--------------|-------|
| Unit | Vitest | ≥ 80% (db-free layer) | `lib/**/*-utils.ts`, `lib/validations/`, pure logic |
| E2E | Playwright | N/A (smoke gate) | Auth flows, dashboard, items CRUD, admin |

## Running Tests

All commands run from `next-app/`:

```bash
# Unit tests
pnpm test              # run all unit tests
pnpm test:coverage     # with v8 coverage report

# E2E tests
pnpm db:seed           # required — seeds admin/editor/viewer demo users
pnpm test:e2e          # Playwright (auto-boots dev server)
```

## Unit Tests (Vitest)

Unit tests live next to the code as `lib/**/*.test.ts` (e.g. `lib/is-admin.test.ts`,
`lib/api-keys-utils.test.ts`, `lib/validations/auth.test.ts`).

### The db-free `*-utils.ts` pattern

`lib/db.ts` **throws if `DATABASE_URL` is unset**, so any module that transitively imports `db`
cannot be unit-tested in isolation. To keep logic testable without a database, **pure logic is
extracted into `*-utils.ts` files** (no `db` import) and only those are imported by `*.test.ts`.

```ts
// lib/api-keys-utils.test.ts — pure functions, no DB needed
import { describe, expect, it } from 'vitest'
import { generateApiKey, parseApiKey, hashKey } from './api-keys-utils'

describe('api-keys-utils', () => {
  it('hashKey is deterministic', () => {
    expect(hashKey('abc')).toBe(hashKey('abc'))
  })
})
```

> **Rule of thumb:** if a function needs the database, it belongs in the action/query layer
> (covered by e2e). If it's pure logic, put it in `*-utils.ts` and unit-test it directly.

## E2E Tests (Playwright)

E2E tests live in `next-app/e2e/*.spec.ts` and need a **seeded database** + a **running dev
server** (the Playwright config auto-boots it locally).

```bash
# Run all e2e tests (chromium project)
pnpm test:e2e

# Run a specific spec
pnpm test:e2e --grep "dashboard"
```

Specs: `auth-flow.spec.ts`, `dashboard-smoke.spec.ts`, `items-crud.spec.ts`, `cobalt-ui.spec.ts`.
There is also a visual-regression project: `pnpm test:vrt` (`pnpm test:vrt:update` to refresh
snapshots).

Demo accounts (after `pnpm db:seed`):

- `admin@example.com` / `Admin123!`
- `editor@example.com` / `Editor123!`
- `viewer@example.com` / `Viewer123!`

## Coverage Gate

The 80% coverage gate covers the **db-free layer** and is enforced by the QA agent
(`/athena:qa --test-only`). It runs `pnpm test:coverage` and blocks merge if coverage drops
below threshold.

```bash
# Check coverage manually
pnpm test:coverage
# Look for: Statements / Functions ≥ 80%
```
