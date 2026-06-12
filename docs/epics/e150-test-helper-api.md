# E150 — Test-Helper API Pattern

> Phase 38 — Cross-Project Extraction | Size: M (5 SP) | Deps: none
> Source: ai-casino-shift E217, originally from ai-clock-work

## Problem

E2E tests (Playwright) need complex preconditions — authenticated users, specific data states, time-dependent records — that are impossible or fragile to create through the UI. Without seed endpoints, E2E tests either skip complex scenarios or use brittle UI setup steps that break on every redesign.

## Solution

Add a triple-guarded test-helper API pattern:

1. **Environment gate**: `ENABLE_TEST_HELPERS` env var must be `true`
2. **Non-production check**: `ENVIRONMENT` must not be `production`
3. **JWT authentication**: Valid token required (no anonymous seeding)

Provide a template endpoint at `/api/v1/test-helpers/seed` with example seed functions and a Playwright fixture that calls them.

## Key Files

| File | Action |
|------|--------|
| `server/app/api/v1/endpoints/test_helpers.py` | New — guarded seed endpoints (~60 lines) |
| `server/app/core/config.py` | Update — add `ENABLE_TEST_HELPERS` setting |
| `docs/openapi.yaml` | Update — document test-helper endpoints |
| `server/tests/integration/test_test_helpers.py` | New — verify guard logic (6 tests) |
| `docs/guides/en/e2e-testing.md` | New — guide on using test helpers in Playwright |
| `docs/epics/e150-test-helper-api.md` | New — this spec |

## Acceptance Criteria

1. Endpoint returns 404 when `ENABLE_TEST_HELPERS` is not `true`
2. Endpoint returns 403 when `ENVIRONMENT` is `production` (even if flag is true)
3. Endpoint returns 401 without valid JWT
4. Seed endpoint creates a user with specified role and returns credentials
5. Seed endpoint is idempotent (same email → same user, no duplicates)
6. Playwright fixture example included in docs
7. All 3 guards have dedicated tests
8. `.env.example` includes `ENABLE_TEST_HELPERS=false` with comment

## Design Notes

- Battle-tested across 3 projects (ai-clock-work, ai-casino-shift, ai-badminton-booking-system)
- Triple guard ensures zero chance of test endpoints leaking to production
- Idempotent seeding means tests can run in any order without cleanup
- Pattern should be promoted to Tier 0 after implementation
