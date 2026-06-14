# E66 — Email Provider Refactor

> **Phase**: 21 | **Size**: M (13 SP) | **Priority**: P0
> **Depends on**: none
> **Branch**: `feat/E66-email-provider-refactor`

---

## Problem Statement

The template uses `fastapi-mail` with SMTP transport exclusively. This creates three problems:
1. Dev requires Mailpit Docker container for email capture
2. Production requires a separate SMTP relay — Zeabur's free HTTP Email API is incompatible
3. No provider abstraction — adding a new email provider means rewriting `MailService`

ai-clock-work solved this with an abstract provider pattern that supports console (dev), Mailgun (HTTP API), and Zeabur Email (HTTP API) providers via a factory singleton.

## Solution

Replace `server/app/services/mail_service.py` with a provider package:

```
server/app/services/email/
  __init__.py          # re-exports get_email_provider, EmailResult
  base.py              # EmailProvider ABC + EmailResult dataclass
  factory.py           # get_email_provider() singleton factory
  console.py           # ConsoleProvider — logs to stdout (dev)
  mailgun.py           # MailgunProvider — HTTP API
  zeabur.py            # ZeaburProvider — HTTP API (AWS SES backend)
  template_renderer.py # Jinja2 template rendering + html_to_plain_text
```

Move inline HTML templates to Jinja2 files:
```
server/app/templates/email/
  verification.html
  password_reset.html
```

## Stories

### S1: Abstract Base + Factory

**AC**:
- [ ] `EmailProvider` ABC with `name` property and `send()` method
- [ ] `EmailResult` dataclass: `success`, `provider`, `message_id`, `error`
- [ ] `get_email_provider()` factory reads `EMAIL_PROVIDER` setting, returns singleton
- [ ] `reset_email_provider()` for test isolation
- [ ] Unknown provider falls back to console with warning log

### S2: Console Provider

**AC**:
- [ ] Logs email to `logger.info()` with to/subject/body
- [ ] Generates `console-{uuid_hex[:8]}` message ID
- [ ] Preserves E2E token capture (`_last_token`, `_last_token_email`) for dev test extraction
- [ ] Returns `EmailResult(success=True, provider="console")`

### S3: Zeabur Email Provider

**AC**:
- [ ] Sends via `POST https://api.zeabur.com/api/v1/zsend/emails`
- [ ] Auth: `Authorization: Bearer {api_key}`
- [ ] Payload: JSON with `from`, `to` (array), `subject`, `html`, `text`
- [ ] Returns `email_id` from response as `message_id`
- [ ] Error handling: HTTP status codes + response text logging

### S4: Mailgun Provider

**AC**:
- [ ] Sends via `POST https://api.mailgun.net/v3/{domain}/messages`
- [ ] Auth: Basic auth `("api", api_key)`
- [ ] Returns `message_id` from response
- [ ] Error handling: HTTP errors logged, returns `EmailResult(success=False)`

### S5: Jinja2 Template Renderer

**AC**:
- [ ] `render_template(name, **context)` loads from `server/app/templates/email/`
- [ ] `html_to_plain_text(html)` strips tags, normalizes whitespace
- [ ] Jinja2 `autoescape` enabled for HTML templates
- [ ] Existing verification + password_reset HTML ported to Jinja2 files

### S6: Integration + Migration

**AC**:
- [ ] `UserManager` updated to use `get_email_provider()` instead of `MailService()`
- [ ] `fastapi-mail` removed from `pyproject.toml`
- [ ] All existing mail_service tests updated for new provider API
- [ ] New tests for each provider (console, mailgun mock, zeabur mock)
- [ ] Coverage gate passes (>=90% server)

## Risk Notes

- **Breaking change**: `MailService` API changes — but only `UserManager` consumes it
- **`fastapi-mail` removal**: Eliminates SMTP transport entirely — users who need SMTP can add an SMTP provider later
- **httpx already available**: Transitive dependency via `httpx-oauth`, no new dependency needed for HTTP providers
- **Jinja2 already available**: Transitive dependency via FastAPI/Starlette
