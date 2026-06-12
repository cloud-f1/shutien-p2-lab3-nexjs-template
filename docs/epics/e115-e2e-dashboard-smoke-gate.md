# E115 — E2E Dashboard Smoke Gate as Deploy Blocker

> Phase 31 — Integration Integrity Shield | Size: M | Deps: E112
> Learned from: ai-casino-shift E161 (dashboard crash in production) + E163 (E2E as blocking gate)

## Problem

E2E tests cover auth flows but never test "login then render dashboard with real data." Casino-shift E161 proved: the gap between "tests pass" and "dashboard crashes in production" is exactly this missing E2E test. The deployer's 6-gate protocol checks pytest, vitest, OpenAPI lint, tsc, git clean, and branch — but not E2E.

## Solution

Add E2E test that logs in, navigates to dashboard, verifies data-driven components render. Wire as Gate 7 in deployer's protocol.

## Key Files

| File | Action |
|------|--------|
| `client/e2e/dashboard-smoke.spec.ts` | New — E2E dashboard smoke test |
| `.claude/agents/deployer.md` | Update — 6 gates to 7 gates |

## Acceptance Criteria

1. E2E spec: register + login → `/dashboard` → assert stat card renders non-empty → navigate 2+ views → assert content
2. Deployer gate protocol: 6 → 7 gates (Gate 7: `npx playwright test dashboard-smoke`)
3. CI already runs all Playwright specs (no workflow change needed)
4. Smoke test uses real API flow, not stubbed at E2E level

## Reference

- ai-casino-shift E163: E2E Dashboard Smoke Gate with 3-role testing (staff, manager, admin)
- Existing E2E: `client/e2e/auth-flow.spec.ts` — pattern to follow
