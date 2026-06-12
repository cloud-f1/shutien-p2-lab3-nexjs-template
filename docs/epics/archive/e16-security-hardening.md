# E16 — Security Hardening

> **Size**: M (1-2 sessions) | **Depends on**: none
> **Status**: spec

---

## Goal

Harden the backend with rate limiting on all endpoints, security response headers, auth event audit logging, and input length constraints on unbounded Text columns.

## No OpenAPI Changes

This epic adds middleware, decorators, and logging — no new endpoints or schema changes.

---

## 1. Rate Limiting (`@limiter.limit()` decorators)

### Current State
- `limiter.py` creates a global SlowAPI limiter with `default_limits=["200/minute"]`
- `main.py` attaches limiter to `app.state` and registers the 429 handler
- No per-endpoint `@limiter.limit()` decorators exist — everything falls back to the 200/min default

### Config Changes (`app/core/config.py`)
Add one new setting:
```python
RATE_LIMIT_GENERAL: str = "200/minute"  # already implicit via limiter default
```
`RATE_LIMIT_AUTH` already exists (`"15/minute"`).

### Per-Endpoint Limits

Every custom endpoint function gets an explicit `@limiter.limit()` decorator. The `Request` parameter is already present on endpoints that need it; add it where missing.

| File | Endpoint | Limit | Rationale |
|------|----------|-------|-----------|
| `auth.py` | `POST /auth/jwt/login` | `settings.RATE_LIMIT_AUTH` (15/min) | Brute-force protection |
| `auth.py` | `POST /auth/jwt/logout` | `settings.RATE_LIMIT_AUTH` | Abuse prevention |
| `auth.py` | `POST /auth/refresh` | `settings.RATE_LIMIT_AUTH` | Token rotation abuse |
| `auth.py` | `GET /auth/test/last-email-token` | `settings.RATE_LIMIT_AUTH` | Dev-only, still limit |
| `sessions.py` | `GET /users/me/sessions` | `settings.RATE_LIMIT_GENERAL` (200/min) | Standard |
| `sessions.py` | `DELETE /users/me/sessions/{id}` | `settings.RATE_LIMIT_GENERAL` | Standard |
| `places.py` | all 6 endpoints | `settings.RATE_LIMIT_GENERAL` | Standard CRUD |
| `portfolios.py` | all 9 endpoints | `settings.RATE_LIMIT_GENERAL` | Standard CRUD |
| `health.py` | `GET /health` | `settings.RATE_LIMIT_GENERAL` | Standard |

**fastapi-users managed routers** (register, reset-password, verify, users, OAuth): These are included via `fastapi_users.get_*_router()` — the global `default_limits=["200/minute"]` already covers them. To apply the stricter auth limit to register/reset/verify, wrap each sub-router inclusion with a rate-limit middleware or apply limits at the router level:

```python
# In auth.py — apply auth-rate limit to fastapi-users sub-routers
_register_router = fastapi_users.get_register_router(UserRead, UserCreate)
_reset_router = fastapi_users.get_reset_password_router()
_verify_router = fastapi_users.get_verify_router(UserRead)

for r in [_register_router, _reset_router, _verify_router]:
    for route in r.routes:
        route.dependencies = [Depends(RateLimitDep(settings.RATE_LIMIT_AUTH))]

router.include_router(_register_router)
router.include_router(_reset_router)
router.include_router(_verify_router)
```

Alternative (simpler): Add a custom middleware or `@app.middleware("http")` that checks if the path starts with `/auth/` and applies the 15/min limit. Choose the approach that is simplest to test.

### Implementation Notes
- Each decorated endpoint must accept `request: Request` as a parameter (SlowAPI requirement)
- `sessions.py` and `portfolios.py` endpoints currently lack `request: Request` — add it
- Key function stays `get_remote_address` (client IP)

---

## 2. Security Headers Middleware

### New File: `server/app/middleware/security_headers.py`

Create a Starlette middleware class that adds headers to every response:

```python
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "0"  # modern browsers, CSP preferred
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https:; "
            "connect-src 'self' https://*.sentry.io; "
            "frame-ancestors 'none'"
        )
        return response
```

### Register in `main.py`
Add **after** CORSMiddleware (middleware stack is LIFO, so this runs after CORS headers are set):
```python
from app.middleware.security_headers import SecurityHeadersMiddleware
app.add_middleware(SecurityHeadersMiddleware)
```

### Header Values Rationale

| Header | Value | Why |
|--------|-------|-----|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking (API should never be framed) |
| `X-XSS-Protection` | `0` | Disabled — modern CSP replaces this; old XSS filters can introduce vulnerabilities |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Restrict browser features |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HSTS — production only |
| `Content-Security-Policy` | see above | Restrict resource loading sources |

---

## 3. Auth Event Audit Logging

### New File: `server/app/core/audit.py`

A structured logger for security-relevant events:

```python
import logging
import uuid
from datetime import datetime, timezone

audit_logger = logging.getLogger("audit")

def log_auth_event(
    event: str,
    *,
    user_id: uuid.UUID | None = None,
    email: str | None = None,
    ip: str | None = None,
    success: bool = True,
    detail: str | None = None,
):
    audit_logger.info(
        "auth_event",
        extra={
            "event": event,
            "user_id": str(user_id) if user_id else None,
            "email": email,
            "ip": ip,
            "success": success,
            "detail": detail,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
```

### Events to Log

| Event | Where | Fields | Trigger |
|-------|-------|--------|---------|
| `LOGIN_SUCCESS` | `auth.py` `login()` | user_id, email, ip | After successful authentication |
| `LOGIN_FAILURE` | `auth.py` `login()` | email, ip | When `authenticate()` returns None |
| `LOGOUT` | `auth.py` `logout()` | user_id, ip | On logout call |
| `TOKEN_REFRESH` | `auth.py` `refresh()` | user_id, ip | After successful token rotation |
| `TOKEN_REFRESH_FAILURE` | `auth.py` `refresh()` | ip, detail | Invalid/revoked/replayed token |
| `PASSWORD_RESET_REQUEST` | UserManager `on_after_forgot_password` | user_id, email | Forgot-password called |
| `PASSWORD_RESET_COMPLETE` | UserManager `on_after_reset_password` | user_id | Password successfully reset |
| `REGISTER` | UserManager `on_after_register` | user_id, email | New user registered |
| `EMAIL_VERIFIED` | UserManager `on_after_verify` | user_id, email | Email verification completed |

### Integration Points
- `auth.py`: Add `log_auth_event()` calls in `login()`, `logout()`, `refresh()`
- `user_manager.py`: Add calls in `on_after_register`, `on_after_forgot_password`, `on_after_reset_password`, `on_after_verify`
- Extract IP from `request.client.host` (already available in login; pass `request` to UserManager hooks via `request` parameter which fastapi-users forwards)

### Log Format
Use Python's standard `logging` with structured `extra` dict. The audit logger should be configured at INFO level. In production (E19), structured JSON logging will be layered on top — for now, the standard formatter suffices.

---

## 4. Input Length Limits on Text Fields

### Current State — Already Constrained
The Pydantic schemas already enforce `max_length` on all Text fields:

| Model | Field | DB Type | Schema Limit |
|-------|-------|---------|-------------|
| `Place` | `description` | `Text` | 2000 (PlaceCreate/PlaceUpdate) |
| `Portfolio` | `description` | `Text` | 2000 (PortfolioCreate/PortfolioUpdate) |
| `PortfolioPlace` | `notes` | `Text` | 1000 (PortfolioPlaceCreate/PortfolioPlaceUpdate) |
| `User` | `avatar_url` | `Text` | No limit in schema |

### Changes Needed

1. **User `avatar_url`**: Add `max_length=2048` to `UserUpdate` schema (standard max URL length). The `UserUpdate` schema is in `app/schemas/user.py` — check if it already has a constraint via fastapi-users' `BaseUserUpdate`.

2. **DB-level constraints**: Add `CheckConstraint` on Text columns as defense-in-depth (Pydantic validates on API input, but direct DB inserts bypass it):
   ```python
   # In place.py model
   description: Mapped[str | None] = mapped_column(Text, nullable=True)
   # Add to __table_args__:
   CheckConstraint("length(description) <= 2000", name="ck_places_description_len")
   ```
   Repeat for `portfolios.description` (2000) and `portfolio_places.notes` (1000).

3. **Alembic migration**: One migration adding the three `CheckConstraint`s. Note: SQLite (test DB) supports `length()` so constraints work in tests too.

---

## Files Changed (Summary)

| File | Change |
|------|--------|
| `server/app/core/config.py` | Add `RATE_LIMIT_GENERAL` setting |
| `server/app/core/limiter.py` | No change (default_limits stays) |
| `server/app/core/audit.py` | **New** — `log_auth_event()` function |
| `server/app/middleware/__init__.py` | **New** — empty |
| `server/app/middleware/security_headers.py` | **New** — SecurityHeadersMiddleware |
| `server/app/main.py` | Register SecurityHeadersMiddleware |
| `server/app/api/v1/endpoints/auth.py` | Add `@limiter.limit()` + audit logging |
| `server/app/api/v1/endpoints/sessions.py` | Add `@limiter.limit()` + `request: Request` param |
| `server/app/api/v1/endpoints/places.py` | Add `@limiter.limit()` + `request: Request` param |
| `server/app/api/v1/endpoints/portfolios.py` | Add `@limiter.limit()` + `request: Request` param |
| `server/app/api/v1/endpoints/health.py` | Add `@limiter.limit()` + `request: Request` param |
| `server/app/services/user_manager.py` | Add audit logging in lifecycle hooks |
| `server/app/schemas/user.py` | Add `max_length=2048` on `avatar_url` in UserUpdate |
| `server/app/models/place.py` | Add `CheckConstraint` for description length |
| `server/app/models/portfolio.py` | Add `CheckConstraint`s for description + notes length |
| `alembic/versions/xxx_add_text_length_constraints.py` | Migration for CheckConstraints |

---

## Test Plan

### Rate Limiting Tests (`tests/test_rate_limit.py`)
- [ ] Auth endpoint returns 429 after 15 requests in 1 minute
- [ ] General endpoint returns 429 after 200 requests in 1 minute
- [ ] 429 response includes `Retry-After` header
- [ ] Different IPs are rate-limited independently

### Security Headers Tests (`tests/test_security_headers.py`)
- [ ] Every response includes `X-Content-Type-Options: nosniff`
- [ ] Every response includes `X-Frame-Options: DENY`
- [ ] Every response includes `Content-Security-Policy` with `default-src 'self'`
- [ ] HSTS header present only when `ENVIRONMENT=production`
- [ ] CORS headers still work correctly (middleware order)

### Audit Logging Tests (`tests/test_audit.py`)
- [ ] Successful login emits `LOGIN_SUCCESS` log with user_id and IP
- [ ] Failed login emits `LOGIN_FAILURE` log with email and IP
- [ ] Token refresh emits `TOKEN_REFRESH` log
- [ ] Failed refresh emits `TOKEN_REFRESH_FAILURE` log
- [ ] Password reset request emits `PASSWORD_RESET_REQUEST` log
- [ ] Registration emits `REGISTER` log

### Input Length Tests (`tests/test_input_limits.py`)
- [ ] `avatar_url` longer than 2048 chars rejected with 422
- [ ] Place description > 2000 chars rejected with 422
- [ ] Portfolio description > 2000 chars rejected with 422
- [ ] PortfolioPlace notes > 1000 chars rejected with 422
- [ ] DB CheckConstraints exist (verify via introspection or migration test)

---

## Acceptance Criteria

- [ ] All auth endpoints rate-limited at 15/min, general at 200/min
- [ ] All responses include security headers (CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- [ ] Auth events (login/logout/refresh/register/reset/verify) produce structured audit log entries
- [ ] All Text fields have Pydantic `max_length` validation
- [ ] DB CheckConstraints exist as defense-in-depth for Text columns
- [ ] Test coverage >= 80% for new code
- [ ] No regressions in existing test suite
