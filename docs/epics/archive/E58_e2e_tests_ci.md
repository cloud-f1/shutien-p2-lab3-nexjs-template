# E58 — E2E Tests in CI

> **Phase**: 19 — Post-v1.0.0 Production Hardening
> **Priority**: P1 | **Points**: 8
> **Depends on**: None (independent)
> **Source**: Cycle 6 audit — Playwright E2E suite exists but never runs in CI

---

## Problem Statement

`client/e2e/auth-flow.spec.ts` has a complete E2E test suite (sign-up, sign-in, forgot-password, email verification). `playwright.config.ts` exists. `@playwright/test` is in `devDependencies`. But `.github/workflows/ci.yml` has zero references to Playwright. Tests only run if a developer manually executes them locally. Auth flow regressions go undetected until production.

## Stories

### E58-S01: CI Playwright Job (5 pts)

**Task**: Add a Playwright E2E job to `.github/workflows/ci.yml`.

**Implementation**:
- Install Playwright browsers
- Start backend (server) + frontend (client) dev servers
- Run `npx playwright test` against the running stack
- Upload test report as artifact on failure
- Gate on PRs to main

**Acceptance Criteria**:
- Given a PR is opened to main
- When CI runs
- Then the Playwright E2E job executes `auth-flow.spec.ts`
- And failures block the PR merge
- And test report artifacts are available for download

### E58-S02: Playwright Config for CI (3 pts)

**Task**: Verify and update `playwright.config.ts` for CI compatibility.

**Changes**:
- Ensure `baseURL` is configurable via env var (default `http://localhost:3000`)
- Add `webServer` config to auto-start dev servers in CI
- Set reasonable timeouts for CI (slower than local)
- Configure retry on CI (1 retry to handle flakiness)

**Acceptance Criteria**:
- Given CI environment (no display)
- When Playwright runs
- Then it auto-starts the dev servers
- And tests complete within 5 minutes
- And headless mode works without X11

## Risk Notes

- **CI time**: Adds ~3-5 min to CI pipeline
- **Flakiness**: E2E tests can be flaky — retry config mitigates
- **Docker services**: May need DB service in CI for backend

## Dependency Chain

```
E58-S02 (config) → E58-S01 (CI job)
```
