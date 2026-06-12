# E4: Email + OAuth Live — Spec

> **Goal**: Replace the email stub with real SMTP delivery and add GitHub as a second OAuth provider alongside the existing Google OAuth.

## Current State

- `mail_service.py`: `_send_smtp()` is a stub — logs warning instead of sending
- `fastapi-mail>=1.4.2` already in `pyproject.toml` but unused
- Google OAuth: wired via `httpx-oauth` + fastapi-users, needs real credentials
- GitHub OAuth: env vars in `.env.example` but no code, no config settings
- `config.py`: missing SMTP auth settings (`SMTP_USER`, `SMTP_PASSWORD`, `SMTP_USE_TLS`)
- `config.py`: missing GitHub OAuth settings (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`)

## OpenAPI Changes

Added to `docs/openapi.yaml`:
- `GET /auth/github/authorize` — returns GitHub authorization URL
- `GET /auth/github/callback` — handles redirect with `code` + `state`, returns `BearerResponse`

Both mirror the existing Google OAuth pattern.

## Implementation Plan

### 1. SMTP Configuration

**Modify**: `server/app/core/config.py`

Add settings:
```python
SMTP_USER: str = ""
SMTP_PASSWORD: str = ""
SMTP_USE_TLS: bool = True
```

### 2. Real Email Delivery

**Modify**: `server/app/services/mail_service.py`

Replace `_send_smtp()` stub with `fastapi-mail` (`ConnectionConfig` + `FastMail`):
- Use `settings.SMTP_*` for connection config
- HTML email templates (inline — no separate template files needed for now)
- Keep development-mode console logging (the if/else branch stays)
- Add retry: single retry on transient SMTP failure (connection reset, timeout)

```python
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType

conf = ConnectionConfig(
    MAIL_USERNAME=settings.SMTP_USER,
    MAIL_PASSWORD=settings.SMTP_PASSWORD,
    MAIL_FROM=settings.SMTP_FROM,
    MAIL_PORT=settings.SMTP_PORT,
    MAIL_SERVER=settings.SMTP_HOST,
    MAIL_STARTTLS=settings.SMTP_USE_TLS,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=bool(settings.SMTP_USER),
)
```

### 3. Email Templates

Inline HTML strings (no Jinja templates):
- **Verification email**: branded header, verify button with link, footer
- **Password reset email**: branded header, reset button with link, expiry note, footer

Keep plain-text fallback in the `body` field for email clients that don't render HTML.

### 4. GitHub OAuth Provider

**Modify**: `server/app/core/config.py`

Add settings:
```python
GITHUB_CLIENT_ID: str = ""
GITHUB_CLIENT_SECRET: str = ""
```

**Modify**: `server/app/api/v1/endpoints/social.py`

Add GitHub OAuth client (conditionally — only if credentials are set):
```python
from httpx_oauth.clients.github import GitHubOAuth2

if settings.GITHUB_CLIENT_ID:
    github_oauth = GitHubOAuth2(settings.GITHUB_CLIENT_ID, settings.GITHUB_CLIENT_SECRET)
    router.include_router(
        fastapi_users.get_oauth_router(
            github_oauth, auth_backend, settings.SECRET_KEY, associate_by_email=True
        ),
        prefix="/github",
    )
```

### 5. Environment Configuration

**Modify**: `server/.env.example`

Add:
```env
SMTP_USER=
SMTP_PASSWORD=
SMTP_USE_TLS=true
```

### 6. Development Setup — Mailpit

Document in spec that `make dev` should optionally spin up Mailpit:
- Default `SMTP_HOST=localhost`, `SMTP_PORT=1025` already point to Mailpit
- `SMTP_USER=""` + `SMTP_USE_TLS=false` for local dev
- Mailpit web UI at `http://localhost:8025` to inspect emails

No Docker Compose changes needed — Mailpit is optional and standalone.

## Test Plan

### New Tests

| Test | File | What |
|------|------|------|
| SMTP sends verification email | `test_mail_service.py` | Mock `FastMail.send_message`, verify called with correct args |
| SMTP sends password reset email | `test_mail_service.py` | Mock `FastMail.send_message`, verify called with correct args |
| SMTP retry on transient failure | `test_mail_service.py` | Mock send to raise once, verify retry succeeds |
| GitHub authorize returns URL | `test_social_oauth.py` | `GET /auth/github/authorize` returns `authorization_url` |
| GitHub disabled when no credentials | `test_social_oauth.py` | With empty `GITHUB_CLIENT_ID`, endpoint returns 404 |
| Google OAuth still works | `test_social_oauth.py` | Existing test remains green |

### Existing Tests

All 28 server tests + 121 client tests must pass unchanged. Email tests that mock console logging should still pass in development mode.

## Acceptance Criteria

- [ ] `_send_smtp()` replaced with real `fastapi-mail` implementation
- [ ] HTML email templates for verification and password reset
- [ ] `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_USE_TLS` in config
- [ ] GitHub OAuth provider (conditional on credentials)
- [ ] `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` in config
- [ ] GitHub endpoints in `openapi.yaml`
- [ ] `.env.example` updated with all new vars
- [ ] 6+ new tests, all existing tests pass
- [ ] Development mode still logs to console (no SMTP needed for `make test`)

## Out of Scope

- Email template files (Jinja) — inline HTML is sufficient for 2 templates
- Email queue / background tasks — direct send is fine at this scale
- OAuth provider selection UI on client — existing SocialButtons component handles this
- Rate limiting on email sends — server-level `RATE_LIMIT_AUTH` covers this
