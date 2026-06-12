# E6: E2E Auth Tests — Spec

> **Epic**: E6 | **Size**: M | **Deps**: E4 (email), E5 (sessions)
> **Author**: @spec-writer | **Date**: 2026-03-11

---

## Goal

Full Playwright E2E test suite covering every auth flow in the application:
register, email verification, login, dashboard access, logout, password reset,
OAuth redirect, protected route guard, and session management.

## Scope

- **No OpenAPI changes** — this epic is pure test infrastructure
- **No feature code changes** — except a test-only API endpoint to extract email tokens
- Expand `client/e2e/auth-flow.spec.ts` (existing 10 smoke tests → full flow suite)
- Add `client/e2e/fixtures/` for reusable auth helpers

## Architecture Decision: Email Token Extraction

In dev mode, `MailService` logs tokens to console (`logger.info("VERIFICATION EMAIL to=%s link=%s")`).
E2E tests can't read server logs. Two options:

| Approach | Pros | Cons |
|----------|------|------|
| **A: Test-only endpoint** | Simple, reliable | Adds code to server |
| **B: MailHog/MailPit SMTP trap** | Real SMTP flow | Extra infra dependency |

**Decision**: **Approach A** — Add `GET /auth/test/last-email-token` endpoint that:
- Only registered when `ENVIRONMENT != "production"`
- Returns the last token captured by MailService (stored in memory)
- Cleared after each read (one-shot)
- Zero production risk (not registered in prod)

### Implementation Detail

```python
# In MailService — dev mode only
_last_token: str | None = None  # module-level, dev only

class MailService:
    async def send_verification_email(self, to: str, token: str) -> None:
        global _last_token
        _last_token = token  # Always capture for E2E
        ...

# In auth.py or test_helpers.py — dev endpoint
@router.get("/test/last-email-token")
async def get_last_email_token():
    token = mail_service._last_token
    mail_service._last_token = None
    return {"token": token}
```

## Test Plan — 5 Test Groups

### Group 1: UI Smoke Tests (existing — keep as-is)

Already in `auth-flow.spec.ts` lines 6–70. 9 tests covering page rendering and navigation.
**No changes needed.**

### Group 2: Registration + Email Verification Flow

| # | Test | Steps |
|---|------|-------|
| 1 | Register new user | Fill form → submit → success banner |
| 2 | Duplicate email shows error | Register same email twice → error banner |
| 3 | Verify email with token | Register → extract token via test endpoint → `GET /verify-email?token=...` → success |
| 4 | Invalid verify token shows error | `GET /verify-email?token=bad` → error state |

### Group 3: Login + Dashboard + Logout Flow

| # | Test | Steps |
|---|------|-------|
| 5 | Login → dashboard → verify user info | Login with seed user → dashboard loads → user profile visible |
| 6 | Logout → redirect to signin | Click logout in dashboard → redirect to `/signin` |
| 7 | Session persists on refresh | Login → reload page → still on dashboard |
| 8 | Invalid credentials show error | (existing — enhance assertion) |

### Group 4: Password Reset Flow

| # | Test | Steps |
|---|------|-------|
| 9 | Forgot password submits successfully | Fill email → submit → success banner (always 202) |
| 10 | Reset password with valid token | Forgot → extract token → navigate to reset page → new password → success |
| 11 | Reset password with bad token | `/reset-password?token=bad` → error state |

### Group 5: Protected Routes + OAuth

| # | Test | Steps |
|---|------|-------|
| 12 | Unauthenticated → redirect to signin | (existing — keep) |
| 13 | Google OAuth redirect | Click Google button → URL contains `accounts.google.com` |
| 14 | Session list visible in dashboard | Login → navigate to Sessions view → at least 1 session |

## Playwright Configuration Updates

### `playwright.config.ts`

```typescript
// Add backend server to webServer array
webServer: [
  {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
  {
    command: "cd ../server && uv run uvicorn app.main:app --port 8000",
    url: "http://localhost:8000/health",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
],
```

### `client/e2e/fixtures/auth.ts` — Reusable Helpers

```typescript
import { Page, expect } from "@playwright/test";

const API_URL = "http://localhost:8000";

/** Register a user via API (skip UI for speed) */
export async function apiRegister(page: Page, email: string, password: string) {
  const resp = await page.request.post(`${API_URL}/auth/register`, {
    data: { email, password },
  });
  expect(resp.ok()).toBeTruthy();
  return resp.json();
}

/** Login via API and set tokens in client storage */
export async function apiLogin(page: Page, email: string, password: string) {
  const resp = await page.request.post(`${API_URL}/auth/jwt/login`, {
    form: { username: email, password },
  });
  expect(resp.ok()).toBeTruthy();
  return resp.json();
}

/** Get last email token from dev endpoint */
export async function getLastEmailToken(page: Page): Promise<string | null> {
  const resp = await page.request.get(`${API_URL}/auth/test/last-email-token`);
  const data = await resp.json();
  return data.token;
}

/** Generate unique email for test isolation */
export function testEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@test.com`;
}
```

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `server/app/services/mail_service.py` | MODIFY | Add `_last_token` capture (dev mode) |
| `server/app/api/v1/endpoints/auth.py` | MODIFY | Add `GET /auth/test/last-email-token` (dev only) |
| `client/playwright.config.ts` | MODIFY | Add backend webServer, increase timeouts |
| `client/e2e/fixtures/auth.ts` | CREATE | Reusable E2E auth helpers |
| `client/e2e/auth-flow.spec.ts` | MODIFY | Add Groups 2-5 (~14 tests → total ~24) |

## Acceptance Criteria

- [ ] All 24 E2E tests pass with both servers running
- [ ] Tests are isolated (unique emails, no shared state between tests)
- [ ] No test depends on another test's side effects
- [ ] Test-only endpoint not registered in production mode
- [ ] Existing 10 smoke tests still pass without backend
- [ ] CI-ready: `pnpm --filter client test:e2e` runs full suite

## Out of Scope

- OAuth callback E2E (requires real Google/GitHub — mock in unit tests only)
- Email delivery verification (covered by unit tests in E4)
- Performance/load testing
- Mobile viewport testing (future epic)
