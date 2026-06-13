# E221 — Next.js E2E Smoke Tests

**Phase:** 53 | **Status:** ✅ Implemented | **Branch:** main (inline, no PR)

## Problem

The original `client/e2e/` tests (Playwright, Vite/React SPA) were deleted as part of the Next.js migration. No e2e coverage exists for the new App Router routes, auth flow, or admin pages.

## Solution

Port key scenarios from the deleted `client/e2e/` tests to Next.js Playwright format.

### Files

- `next-app/playwright.config.ts` — chromium project, `baseURL` from env, `webServer` auto-starts `pnpm dev` locally
- `next-app/e2e/helpers/auth.ts` — `loginAs(page, email, password)` helper + `SEED_ADMIN` constant
- `next-app/e2e/auth-flow.spec.ts` — 6 tests: unauthenticated redirect, page loads, client-side validation, login success, admin badge, sign out
- `next-app/e2e/dashboard-smoke.spec.ts` — 10 tests: dashboard load, sidebar, admin nav, settings page/forms, admin user list/role selector, health endpoint

### Running tests

```bash
# Prerequisites: dev server running + DB seeded
cd next-app
npx playwright test                    # run all
npx playwright test e2e/auth-flow.spec.ts  # specific file
npx playwright test --ui               # interactive UI mode
```

`pnpm run dev` is auto-started by `webServer` config when `CI` env var is not set.

### Seed requirement

Tests assume `admin@example.com` / `Admin123!` exists (from `drizzle/seed.ts`). Run `pnpm db:seed` before first test run.

## Acceptance Criteria

- [x] `playwright.config.ts` valid TypeScript (tsc checks pass)
- [x] Auth flow tests cover: redirect, page loads, client validation, login success, sign out
- [x] Dashboard smoke covers: settings forms, admin page, health endpoint
- [x] `webServer.reuseExistingServer = true` — tests reuse a running dev server

## Dependencies

- Requires E219 (settings pages must exist)
- Requires E220 (admin page must exist)
