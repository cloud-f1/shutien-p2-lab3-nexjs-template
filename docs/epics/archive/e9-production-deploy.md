# E9 — Production Deploy

> **Size**: M (1-2 sessions) | **Depends on**: E6 (E2E tests)
> **Status**: spec

---

## Overview

Harden the project for production deployment on Zeabur. Adds Sentry error tracking, production environment validation, improved zbpack.json configs, and a deployment checklist.

## No OpenAPI Changes

This epic does not add API endpoints. Health endpoint already exists.

## Server Changes

### 1. Sentry SDK Integration
- Add `sentry-sdk[fastapi]` to dependencies
- Initialize in `app/main.py` gated by `SENTRY_DSN` env var
- Captures unhandled exceptions + performance traces
- Set `traces_sample_rate` to 0.1 in production (10%)
- Environment + release tags from settings

### 2. Config Hardening (`app/core/config.py`)
- Add `SENTRY_DSN: str = ""` (empty = disabled)
- Add `APP_VERSION: str = "0.1.0"` for Sentry release tagging
- Validate `REFRESH_SECRET_KEY != SECRET_KEY` in production
- Validate `ALLOWED_ORIGINS_STR` is not default localhost in production

### 3. zbpack.json Improvements
- Server: separate build + migration into proper sequence
- Add health check path for Zeabur probe

## Client Changes

### 1. Sentry SDK Integration
- Add `@sentry/react` to dependencies
- Initialize in `main.tsx` gated by `VITE_SENTRY_DSN` env var
- ErrorBoundary integration with Sentry.ErrorBoundary
- Browser tracing for performance

### 2. Build Configuration
- Ensure `VITE_API_URL` is validated at build time
- Source maps upload to Sentry (optional, via build plugin)

## Deployment Checklist

Create `docs/deploy-checklist.md`:
1. Zeabur project + services created (server, client, PostgreSQL)
2. All env vars set (SECRET_KEY, REFRESH_SECRET_KEY, DATABASE_URL, etc.)
3. VITE_API_URL set to production API URL in client service
4. OAuth callback URLs updated for production domain
5. SMTP configured (Resend/Mailgun) for production email
6. Health probe: `GET /health` returns 200
7. Sentry DSN configured (optional but recommended)
8. CORS origins updated in ALLOWED_ORIGINS_STR

## Test Stories

### Server
1. Sentry init with valid DSN → SDK initializes
2. Sentry init with empty DSN → SDK not initialized (no-op)
3. Config validation: same SECRET_KEY and REFRESH_SECRET_KEY in production → raises ValueError
4. Health endpoint still works with Sentry middleware

### Client
1. Sentry init with VITE_SENTRY_DSN → SDK initializes
2. Build succeeds without VITE_SENTRY_DSN (optional)

## Security Notes

- Sentry DSN is not a secret (it's a write-only ingest URL) — safe in client env
- Source maps should NOT be served to production users — upload to Sentry, exclude from dist
- All actual secrets (SECRET_KEY, DB password, OAuth secrets) are server-side only
