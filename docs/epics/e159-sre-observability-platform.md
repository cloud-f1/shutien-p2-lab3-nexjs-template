# E159 — SRE Observability Platform (Structured Logs + Health SLI + Sentry Audit)

> Phase 40 — Self-Review Improvements | Size: L (8 SP) | Deps: none
> Source: self-review 2026-04-24 + sibling project Chronos SRE platform pattern

## Problem

Current observability state:

- **Sentry**: both `sentry-sdk[fastapi]` (server) and `@sentry/react` (client) are installed — but there is **no documented init, no DSN-in-env guardrail, no sampling policy, no release tagging**. Sentry may be silently no-op in production.
- **Structured logs**: server uses Python stdlib `logging`, not JSON/structured. No correlation IDs across request → DB → response.
- **Health SLI**: `/health` exists (E105) as liveness, but no SLI dashboard — success rate, p50/p95 latency, DB pool saturation.
- **Staging**: production is the only Zeabur environment. Migrations get live-fire tested on real users.

Chronos (sibling project) has a working SRE platform: Typer CLI + Telegram alerts + Zeabur GraphQL for deploy status + structured JSON logs + `/metrics` endpoint. Most of that is template-shaped and portable.

## Solution

Four stackable deliverables, each independently mergeable:

### 1. Sentry wiring audit + enforcement

- `server/app/observability/sentry.py` — init with DSN, sample rate, release from `GIT_SHA` env, `environment` tag
- `client/src/observability/sentry.ts` — same contract
- Fail-fast runtime check: if `ENVIRONMENT=production` and `SENTRY_DSN` is empty, `main.py` raises on startup
- `.env.example` documents both DSNs with clear placeholder

### 2. Structured JSON logging

- `server/app/observability/logging.py` — `structlog` with `processors.JSONRenderer`
- Middleware injects `request_id` (UUID v4) + `user_id` (if authed) into log context
- `@debugger` agent instruction: include `request_id` in every bug report

### 3. Health SLI endpoint

- `GET /admin/sli` (superuser only, reuses E105 auth) returns:
  - Rolling 5-min success rate (from structured logs aggregated in memory, no external dep)
  - p50/p95 latency for top 10 endpoints
  - DB pool status (checked_out, overflow, total)
  - Last N Sentry events (via `sentry-sdk.get_client().transport.queue_size` or similar)
- Dashboard view in `client/src/pages/dashboard/SystemHealthView.tsx` (stub exists) consumes it

### 4. Staging environment on Zeabur

- Add `ENVIRONMENT=staging` service alongside prod in Zeabur docs
- `/athena:deploy staging` (already scaffolded) actually routes to staging service ID
- Migration review gate (E157) runs against staging DB snapshot before prod deploy

### 5. Chronos SRE platform port — `scripts/sre/` CLI

Borrow the validated pattern from sibling project Chronos: a Typer-based CLI that exposes ops primitives. No Telegram coupling (optional) — the CLI is the core.

- `scripts/sre/main.py` — Typer app, entrypoint `uv run sre`
- Commands:
  - `sre logs tail <service>` — stream structured logs with correlation-id filter
  - `sre deploy status` — Zeabur GraphQL query for last N deploys + commit SHA + health
  - `sre sli` — fetch `/admin/sli` and pretty-print
  - `sre rollback <service>` — trigger Zeabur rollback to previous deploy (requires confirm)
  - `sre alert test` — emit a test Sentry event to verify the pipeline
- `scripts/sre/README.md` — setup (ZEABUR_TOKEN, SENTRY_AUTH_TOKEN)
- Optional Telegram bridge: `scripts/sre/telegram.py` reads from env `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`; if unset, no-op. The CLI is useful without it.

This makes SRE ergonomics portable: any future project scaffolded from the template gets working ops day-one instead of reinventing.

## Key Files

| File | Action |
|------|--------|
| `server/app/observability/sentry.py` | New |
| `server/app/observability/logging.py` | New — structlog config |
| `server/app/observability/middleware.py` | New — request_id + timing middleware |
| `server/app/api/v1/endpoints/admin.py` | Edit — add `GET /admin/sli` |
| `server/app/main.py` | Edit — wire observability + fail-fast check |
| `server/pyproject.toml` | Edit — add `structlog>=24.1` |
| `client/src/observability/sentry.ts` | New |
| `client/src/main.tsx` | Edit — init sentry before `<App />` |
| `client/src/pages/dashboard/SystemHealthView.tsx` | Edit — consume `/admin/sli` |
| `.env.example` | Edit — SENTRY_DSN_SERVER, VITE_SENTRY_DSN, GIT_SHA |
| `.claude/commands/athena/deploy.md` | Edit — staging routing |
| `docs/guides/en/sre-observability.md` | New — how to read SLI + triage |
| `docs/guides/zh-TW/sre-observability.md` | New |
| `scripts/sre/main.py` | New — Typer CLI (logs / deploy / sli / rollback / alert) |
| `scripts/sre/zeabur_client.py` | New — Zeabur GraphQL wrapper |
| `scripts/sre/telegram.py` | New — optional Telegram bridge (no-op if env unset) |
| `scripts/sre/README.md` | New — setup + command reference |
| `server/pyproject.toml` | Edit — also add `typer>=0.12` + `gql[aiohttp]` for SRE CLI |

## Implementation Sketches

### Sentry init (server)

```python
# server/app/observability/sentry.py
import os
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

def init_sentry() -> None:
    dsn = os.getenv("SENTRY_DSN_SERVER", "")
    env = os.getenv("ENVIRONMENT", "development")

    if env == "production" and not dsn:
        raise RuntimeError("SENTRY_DSN_SERVER required in production")

    if not dsn:
        return  # dev/test: Sentry off

    sentry_sdk.init(
        dsn=dsn,
        environment=env,
        release=os.getenv("GIT_SHA", "unknown"),
        traces_sample_rate=0.1 if env == "production" else 1.0,
        profiles_sample_rate=0.1 if env == "production" else 0.0,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        send_default_pii=False,  # GDPR-safe default
    )
```

### Structured log + request_id middleware

```python
# server/app/observability/middleware.py
import uuid
import time
import structlog
from starlette.middleware.base import BaseHTTPMiddleware

log = structlog.get_logger()

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        rid = request.headers.get("x-request-id") or str(uuid.uuid4())
        structlog.contextvars.bind_contextvars(request_id=rid)
        start = time.perf_counter()
        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start) * 1000
            log.info("request", method=request.method, path=request.url.path,
                     status=response.status_code, duration_ms=round(duration_ms, 2))
            response.headers["x-request-id"] = rid
            return response
        finally:
            structlog.contextvars.clear_contextvars()
```

## Alignment / Cross-Epic Hooks

- **Writes to**: Sentry (structured events), stdout JSON logs (with `request_id`), `/admin/sli` endpoint (consumed by dashboard)
- **Consumed by**: E161 (SecurityEvent `refresh_reuse` goes to Sentry breadcrumb), E164 (deploy confidence reads SLI regressions)
- **Provides**: `scripts/sre/main.py` Typer CLI — baseline ops ergonomics for all template consumers
- **Debugger contract update**: `@debugger` agent instruction enriched to include `request_id` in every bug report (cross-references structured logging)
- **Does NOT bump** Stop-verifier rule count (ops layer, not a Stop concern)
- **Env contract**: new required env vars — `SENTRY_DSN_SERVER`, `VITE_SENTRY_DSN`, `GIT_SHA`, optional `ZEABUR_TOKEN`

## Acceptance Criteria

- [ ] `SENTRY_DSN_SERVER` missing in production crashes startup with clear message
- [ ] Every request log line is JSON with `request_id`, `user_id`, `method`, `path`, `status`, `duration_ms`
- [ ] `GET /admin/sli` returns 200 for superuser with `success_rate_5m`, `p50_ms`, `p95_ms`, `db_pool`
- [ ] System Health dashboard view renders live SLI data
- [ ] Staging service documented in `docs/guides/en/sre-observability.md`
- [ ] `GIT_SHA` env var baked into Sentry `release` tag (so Sentry links stack traces to commits)
- [ ] Dev mode with empty DSN stays silent (no warnings, no crashes)

## Out of Scope

- External metric store (Prometheus, Grafana) — in-memory SLI is enough for template
- Tracing spans beyond request-level (DB query tracing can be added later)
- Telegram / Slack alert pipeline — Chronos-style automation is a follow-up epic
