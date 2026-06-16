# Testing Guide

> Architecture reference: [../techstack/architecture.md](../techstack/architecture.md).

The app under `next-app/` has a two-tier test suite: **Vitest** unit tests for pure logic and
**Playwright** e2e tests for browser flows. All commands run from `next-app/`.

## Unit Tests (Vitest)

```bash
cd next-app
pnpm test              # run all unit tests once
pnpm test:watch        # watch mode
pnpm test:coverage     # with v8 coverage report
```

Unit tests live next to the code they cover as `lib/**/*.test.ts` (e.g. `lib/is-admin.test.ts`,
`lib/api-keys-utils.test.ts`, `lib/validations/auth.test.ts`).

### The `*-utils.ts` (db-free) pattern

`lib/db.ts` **throws if `DATABASE_URL` is unset**, so importing anything that transitively imports
`db` blows up in a unit test. To keep logic testable without a database, **pure logic is extracted
into `*-utils.ts` files** that never import `db` — only those are imported by `*.test.ts`.

Examples of the db-free layer: `lib/api-keys-utils.ts`, `lib/team-utils.ts`,
`lib/notifications-utils.ts`, `lib/webhooks-utils.ts`, plus the Zod schemas in `lib/validations/`.

```ts
// lib/api-keys-utils.test.ts — no DB needed, pure functions
import { describe, expect, it } from "vitest"
import { generateApiKey, parseApiKey, hashKey } from "./api-keys-utils"

describe("api-keys-utils", () => {
  it("hashKey is deterministic", () => {
    expect(hashKey("abc")).toBe(hashKey("abc"))
  })
})
```

> **Rule of thumb:** if a function needs the database, it belongs in the action/query layer
> (covered by e2e). If it's pure logic, put it in `*-utils.ts` and unit-test it directly.

## E2E Tests (Playwright)

E2E tests live in `next-app/e2e/*.spec.ts` (`auth-flow.spec.ts`, `dashboard-smoke.spec.ts`,
`items-crud.spec.ts`, `cobalt-ui.spec.ts`). They need a **seeded database** and a **running
dev server** — the Playwright config auto-boots the dev server locally.

```bash
cd next-app
pnpm db:seed           # required — seeds admin/editor/viewer demo users
pnpm test:e2e          # Playwright (chromium project)
pnpm test:e2e --grep "dashboard"   # run a subset
```

Seed accounts (from `drizzle/seed.ts`):

- `admin@example.com` / `Admin123!`
- `editor@example.com` / `Editor123!`
- `viewer@example.com` / `Viewer123!`

There is also a visual-regression-test (VRT) project: `pnpm test:vrt` (and
`pnpm test:vrt:update` to refresh snapshots).

## Coverage Gate

- **Db-free layer ≥ 80%** — `pnpm test:coverage` (v8). The QA agent (`/athena:qa --test-only`)
  enforces this and blocks merge if it drops below threshold.
- **Never** lower the threshold. **Never** comment out tests.

```bash
# Check coverage manually
pnpm test:coverage
# Look for: Statements / Functions ≥ 80% on the db-free layer
```
