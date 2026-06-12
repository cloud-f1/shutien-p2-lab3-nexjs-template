# E2E Testing with Test Helpers

> How to use the triple-guarded seed API in Playwright tests.

## Overview

The test-helper endpoints (`/api/v1/test-helpers/seed` and `/reset`) let Playwright tests create preconditions (users, roles) without fragile UI automation. Three independent safety gates ensure these endpoints never run in production.

## Safety Gates

| Gate | Check | Failure |
|------|-------|---------|
| 1 | `ENABLE_TEST_HELPERS=true` env var | 404 Not Found |
| 2 | `ENVIRONMENT != production` | 403 Forbidden |
| 3 | Valid JWT in `Authorization` header | 401 Unauthorized |

All three must pass for any seed request to succeed.

## Setup

1. Set environment variables in your `.env` (or CI config):

```bash
ENABLE_TEST_HELPERS=true
ENVIRONMENT=development   # or "staging" — never "production"
```

2. Ensure you have an existing user account to authenticate with (e.g., the default seed accounts).

## Playwright Fixture Example

```typescript
// e2e/fixtures/test-helpers.ts
import { test as base, expect } from '@playwright/test';

type TestHelpers = {
  seedUser: (email: string, password: string, isSuperuser?: boolean) => Promise<{ id: string; email: string }>;
  resetUser: (email: string) => Promise<void>;
};

export const test = base.extend<{ testHelpers: TestHelpers }>({
  testHelpers: async ({ request }, use) => {
    const API_URL = process.env.VITE_API_URL ?? 'http://localhost:8080';

    // Authenticate to get a JWT (Gate 3)
    const loginResp = await request.post(`${API_URL}/auth/jwt/login`, {
      form: {
        username: 'admin@test.com',
        password: 'Admin#Pass1',
      },
    });
    expect(loginResp.ok()).toBeTruthy();
    const { access_token } = await loginResp.json();
    const headers = { Authorization: `Bearer ${access_token}` };

    const seedUser = async (email: string, password: string, isSuperuser = false) => {
      const resp = await request.post(`${API_URL}/api/v1/test-helpers/seed`, {
        headers,
        data: { email, password, is_superuser: isSuperuser },
      });
      expect(resp.status()).toBeLessThan(300);
      return resp.json();
    };

    const resetUser = async (email: string) => {
      const resp = await request.post(`${API_URL}/api/v1/test-helpers/reset`, {
        headers,
        data: { email },
      });
      expect(resp.status()).toBe(204);
    };

    await use({ seedUser, resetUser });
  },
});

export { expect };
```

## Usage in Tests

```typescript
// e2e/specs/dashboard.spec.ts
import { test, expect } from '../fixtures/test-helpers';

test('admin can see system health', async ({ page, testHelpers }) => {
  // Seed a superuser via API — no UI clicks needed
  const user = await testHelpers.seedUser('e2e-admin@test.com', 'E2eAdmin#1', true);

  // Now login through the UI
  await page.goto('/signin');
  await page.fill('[name="email"]', 'e2e-admin@test.com');
  await page.fill('[name="password"]', 'E2eAdmin#1');
  await page.click('button[type="submit"]');

  // Verify dashboard loads
  await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
});

test.afterEach(async ({ testHelpers }) => {
  // Clean up seeded users
  await testHelpers.resetUser('e2e-admin@test.com');
});
```

## Key Properties

- **Idempotent**: Calling `/seed` twice with the same email returns the existing user (200) instead of failing. Tests can run in any order.
- **Isolated**: Each test seeds its own users with unique emails. No shared mutable state.
- **Fast**: Direct API calls skip UI rendering. Seed + login takes ~50ms vs ~3s through the UI.

## CI Configuration

In your CI pipeline, set the env vars on the server before running Playwright:

```yaml
# .github/workflows/e2e.yml
env:
  ENABLE_TEST_HELPERS: 'true'
  ENVIRONMENT: staging
```

The production deploy pipeline should **never** set `ENABLE_TEST_HELPERS=true`. Even if someone does, Gate 2 blocks execution when `ENVIRONMENT=production`.
