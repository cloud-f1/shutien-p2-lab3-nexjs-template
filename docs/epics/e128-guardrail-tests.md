# E128 — Guardrail Test Template

## Goal
Create `server/tests/guardrails/` with security-focused tests that validate the app never leaks sensitive information in error responses, URLs, or logs.

## Test Files

1. **test_no_pii_in_errors.py** — Parametrized tests hitting error endpoints (400/401/403/404/422), asserting no email, phone, or password values appear in response bodies.
2. **test_no_tokens_in_urls.py** — Verify OAuth authorize endpoints return `authorization_url` without JWT tokens in query params. Check no `access_token=` or `token=` leaks.
3. **test_no_secrets_in_logs.py** — Use `caplog` to capture logs during login/token operations, assert SECRET_KEY, REFRESH_SECRET_KEY, raw passwords, and JWT tokens (`eyJ` prefix) never appear.

## Markers
- All tests use `@pytest.mark.unit` (lightweight, no real DB needed beyond test SQLite).

## Acceptance
- `uv run pytest tests/guardrails/ -v` — all green
- No new dependencies required
