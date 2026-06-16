# E2E Testing with Playwright

> How to seed preconditions and write end-to-end tests with Playwright.

## Overview

E2E specs live in `next-app/e2e/` as `*.spec.ts` files and run against a real dev server with a seeded database. Instead of fragile UI automation to create users and roles, tests rely on the deterministic seed (`pnpm db:seed`) for the demo accounts, and on Playwright's `request` fixture for any direct API calls (Route Handlers under `app/api/**/route.ts`).

## Setup

1. Seed the database with the demo accounts before running e2e:

```bash
cd next-app
pnpm db:seed     # admin@example.com / Admin123! · editor@example.com / Editor123! · viewer@example.com / Viewer123!
```

2. Run the suite (Playwright's `webServer` auto-boots `pnpm dev` locally):

```bash
pnpm test:e2e
```

The seeded accounts are idempotent — re-running `pnpm db:seed` is safe and gives every spec the same starting roles (admin / editor / viewer) for the 3-tier RBAC.

## Playwright Fixture Example

If a spec needs to authenticate via the API (a Route Handler) rather than the login form, extend the base test with a fixture:

```typescript
// e2e/fixtures/auth.ts
import { test as base, expect } from '@playwright/test';

type AuthHelpers = {
  loginAs: (email: string, password: string) => Promise<void>;
};

export const test = base.extend<{ authHelpers: AuthHelpers }>({
  authHelpers: async ({ page }, use) => {
    const loginAs = async (email: string, password: string) => {
      await page.goto('/login');
      await page.fill('[name="email"]', email);
      await page.fill('[name="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
    };

    await use({ loginAs });
  },
});

export { expect };
```

## Usage in Tests

```typescript
// e2e/dashboard.spec.ts
import { test, expect } from './fixtures/auth';

test('admin can see the admin panel', async ({ page, authHelpers }) => {
  // Use a seeded account — no per-test user creation needed
  await authHelpers.loginAs('admin@example.com', 'Admin123!');

  // Verify the dashboard loads
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
});

test('viewer cannot reach the admin panel', async ({ page, authHelpers }) => {
  await authHelpers.loginAs('viewer@example.com', 'Viewer123!');

  await page.goto('/admin');
  // RBAC guard re-reads the role from the DB and redirects
  await expect(page).not.toHaveURL(/\/admin/);
});
```

## Key Properties

- **Deterministic seed**: `pnpm db:seed` always produces the same three demo accounts and roles, so specs share a known starting state.
- **Isolated**: Each spec drives its own session through the UI (or the `request` fixture). No shared mutable state between specs.
- **RBAC-aware**: Server-side guards re-read the role from the DB on every request, so role-based specs (admin / editor / viewer) exercise the real authorization path.

## CI Configuration

In CI, seed the database before running Playwright:

```yaml
# .github/workflows/e2e.yml
steps:
  - run: pnpm db:seed
    working-directory: next-app
  - run: pnpm test:e2e
    working-directory: next-app
```

The production deploy pipeline should **never** seed demo accounts. Keep the seed step scoped to test/CI databases only.
