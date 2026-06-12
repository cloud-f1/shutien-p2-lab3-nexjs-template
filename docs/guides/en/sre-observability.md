# SRE Observability Guide

> How to read the SLI dashboard, triage Sentry events, and follow a `request_id` end-to-end. Production-ready from day one — no extra services to install.

---

## What you get out of the box (E159)

| Layer | Tool | Where it lives |
|-------|------|----------------|
| Error tracking | `@sentry/react` (browser) + `sentry-sdk[fastapi]` (server) | `client/src/observability/sentry.ts`, `server/app/observability/sentry.py` |
| Structured logs | `structlog` JSON renderer | `server/app/observability/logging.py` |
| Per-request correlation | `RequestIDMiddleware` | `server/app/observability/middleware.py` |
| Health SLI | `GET /admin/sli` (superuser only) + `SystemHealthView` dashboard | `server/app/observability/sli.py`, `client/src/pages/dashboard/views/SystemHealthView.tsx` |
| Future: SRE CLI | Typer-based `scripts/sre/` | Deferred to a follow-up dispatch (E159 Part 5) |

---

## Required env vars

```bash
# Server
ENVIRONMENT=production            # production | staging | development
SENTRY_DSN_SERVER=https://...     # REQUIRED in production (startup fails fast)
GIT_SHA=$(git rev-parse --short HEAD)   # release tag for Sentry deep-links

# Client (baked at build time — set BEFORE pnpm build)
VITE_SENTRY_DSN=https://...       # browser DSN (different project from server)
VITE_GIT_SHA=$(git rev-parse --short HEAD)
```

Empty server DSN in production crashes startup with a clear message — that is
on purpose. Empty client DSN in production logs a `console.warn` (we do not
want to refuse to render the SPA just because Sentry is down).

Dev / test with empty DSN is a silent no-op.

---

## Reading the SLI dashboard

Open the app, sign in as a superuser (default seed: `admin@test.com` / `Admin#Pass1`), then navigate to **Dashboard → System Health**. The view auto-refreshes every 30 seconds.

You will see two stacks of panels:

### Top stack — `/admin/health` (synchronous probes)

| Panel | What it shows | Yellow flag |
|-------|---------------|-------------|
| Database | Connected / disconnected + ping latency | latency > 50 ms is suspicious for a healthy pool |
| Email Provider | Configured? Which one (`console`/`mailgun`/`zeabur`) | `Not configured` in production = silent failure |
| OAuth Providers | Which providers are wired | Empty in production if you advertise OAuth |
| Application | Version, uptime, environment | Frequent uptime resets suggest crashes or auto-redeploys |

### Bottom stack — `/admin/sli` (rolling 5-minute aggregate, in-process)

| Panel | What it shows | Triage threshold |
|-------|---------------|------------------|
| Success Rate (5m) | `(2xx + 3xx + 4xx) / total` | < 99% = investigate; sustained < 95% = page |
| Latency (5m) | p50 / p95 across all requests | p95 > 500 ms is the canary; > 1 s = degraded |
| DB Connection Pool | size / checked-out / overflow | `checked_out` near `size` = saturating; `overflow` > 0 means we are leaking |
| Release | Current `GIT_SHA` + environment | Sanity check: did the latest deploy actually take? |
| Top Endpoints | Path · count · success · p50 · p95 | Look for hotspots and per-endpoint regressions |

> **Note** — the SLI snapshot is **per-replica, in-process**. With 1 replica it tells the whole truth. With N replicas, refresh a few times to sample each — for cross-replica truth you point Sentry / Zeabur dashboards at the same field names.

---

## Triaging a Sentry event

When an event lands in Sentry:

1. Open the event. The `tags` panel includes:
   - `release` — the `GIT_SHA` of the deploy that emitted the event
   - `environment` — `production` / `staging` / `development`
2. **Find the `request_id` in the breadcrumbs** (server events) or in the event's contexts (browser events). Every server log line for that request shares the same id.
3. Search the structured server logs for that id:
   ```bash
   # Local docker-compose
   docker compose logs server | grep '"request_id":"<id>"'
   # Zeabur — use the dashboard's log search box with the literal id string
   ```
4. Walk the timeline: HTTP entry → DB calls → response status. The `duration_ms` on each line tells you which step was slow.
5. If the bug reproduces locally, the **same `request_id` flow** works against the local server because `RequestIDMiddleware` is always on.

---

## `request_id` correlation contract

The middleware ([server/app/observability/middleware.py](../../../server/app/observability/middleware.py)):

- Uses an existing `x-request-id` header if the client sent one, else generates a new UUID v4.
- Binds the id into `structlog.contextvars` for the whole request.
- Echoes it back in the response `x-request-id` header.

The client never needs to set this header explicitly — the server will generate one. But if you have a frontend that wants to correlate with its own tracing, send `x-request-id` from the SPA and the server will preserve it.

The `@debugger` agent expects every bug report to include a `request_id`. The header is the cheapest correlation surface we have, so use it.

---

## Staging vs production env

Two Zeabur projects, same `Dockerfile`:

| | Staging | Production |
|---|---------|-----------|
| `ENVIRONMENT` | `staging` | `production` |
| `SENTRY_DSN_SERVER` | optional but recommended (own project) | REQUIRED |
| `GIT_SHA` | set | set |
| Migration review | first stop — E157 review SQL runs against staging snapshot | only after staging is green |
| Sentry environment tag | `staging` | `production` |
| Audience | the team | end users |

`/athena:deploy staging` routes to the staging service IDs (see [`.claude/commands/athena/deploy.md`](../../../.claude/commands/athena/deploy.md)). The deployer fails loudly if the staging service IDs are not set rather than guessing.

---

## Where to find logs

| Place | Format | Best for |
|-------|--------|----------|
| Local terminal (`uvicorn`) | structlog JSON to stdout | dev iteration |
| `docker compose logs server` | same JSON, captured | smoke tests |
| Zeabur dashboard → Logs | same JSON, searchable | prod triage |
| Sentry → Issues | grouped, with breadcrumbs + tags | error surface |
| `/admin/sli` | rolling SLI snapshot | "is the system OK right now?" |

The single source of correlation across all of these is `request_id`.

---

## Common questions

**Q. The success_rate_5m panel shows 100% but I know there were errors.**
A. The SLI counts 5xx as failures only. 4xx (client errors) are intentional and are scored as successes. Look at top-endpoints to find paths with anomalous 4xx rates if validation is bleeding through.

**Q. checked_out is climbing and never returns to 0.**
A. Connection leak. Search structured logs for the request id of the slowest endpoint and check that the FastAPI dependency `get_db` is being awaited on every code path (especially error handlers).

**Q. Sentry release shows `unknown`.**
A. `GIT_SHA` was not set at deploy time. Add it to the Zeabur env and redeploy. For the client, remember it must be set BEFORE `pnpm build` because Vite bakes `import.meta.env` at build time.

**Q. Can I get cross-replica SLI?**
A. Not from `/admin/sli` alone — point Zeabur metrics or Sentry transactions at the same metric names. The in-process snapshot is for triage, not for billing.

---

## Future work — SRE CLI (E159 Part 5)

A Typer-based CLI in `scripts/sre/` is planned for a separate dispatch:

- `sre logs tail <service>` — stream logs filtered by request id
- `sre sli` — fetch `/admin/sli` and pretty-print
- `sre deploy status` — Zeabur GraphQL query
- `sre rollback <service>` — Zeabur rollback (with confirm)
- `sre alert test` — emit a Sentry test event

Until that lands, the dashboard view + Zeabur logs + Sentry are the supported surfaces.

---

## File reference

- Server: [`server/app/observability/`](../../../server/app/observability/)
- Client: [`client/src/observability/sentry.ts`](../../../client/src/observability/sentry.ts)
- Dashboard: [`client/src/pages/dashboard/views/SystemHealthView.tsx`](../../../client/src/pages/dashboard/views/SystemHealthView.tsx)
- Spec: [`docs/epics/e159-sre-observability-platform.md`](../../epics/e159-sre-observability-platform.md)
- Deploy routing: [`.claude/commands/athena/deploy.md`](../../../.claude/commands/athena/deploy.md)
