# E293 — Baseline Observability

## Problem

The template ships with zero error-visibility infrastructure:

- `lib/audit.ts` swallows all DB-write failures with an empty `catch {}` block — audit errors disappear silently.
- There is no structured logger; `console.log/warn/error` scatter throughout server code with no consistent format.
- There is no error-tracking integration — uncaught exceptions on the server surface only in raw process output (or nowhere in serverless deployments).

Operators and developers have no way to know when things break silently.

## Solution

Add a minimal, zero-config-by-default observability layer:

1. **`next-app/instrumentation.ts`** — Next.js `register()` hook. Dynamically imports and initialises `@sentry/nextjs` only when `SENTRY_DSN` is set; is a complete no-op otherwise. Respects `NEXT_RUNTIME` to guard server vs edge init.
2. **`next-app/lib/logger.ts`** — tiny structured logger (info / warn / error). Emits JSON lines in production (`NODE_ENV=production`), human-readable prefix lines in dev. Zero external deps; db-free; safe in Server Components.
3. **`lib/audit.ts`** — replace `catch {}` with `catch (e) { logger.error("audit write failed", e) }` so audit failures are at least visible in logs.
4. **`.env.example`** — document `SENTRY_DSN` (optional; unset = no-op).

## Key Files

| File | Change |
|---|---|
| `next-app/instrumentation.ts` | New — Next.js `register()` Sentry init hook |
| `next-app/lib/logger.ts` | New — structured logger (info/warn/error) |
| `next-app/lib/logger.test.ts` | New — unit tests for logger |
| `next-app/lib/audit.ts` | Patch — `catch (e)` → `logger.error(...)` |
| `next-app/.env.example` | Patch — add `SENTRY_DSN` entry |
| `next-app/package.json` | Patch — add `@sentry/nextjs` dependency |

## Acceptance Criteria

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass with `SENTRY_DSN` unset.
- `lib/logger.ts` has unit tests covering info/warn/error in both dev and prod modes.
- `lib/audit.ts` no longer has a silent `catch {}` block.
- `instrumentation.ts` is a complete no-op when `SENTRY_DSN` is unset (verified by build passing without any Sentry env vars).
- `next.config.ts` is untouched.
- `lib/openapi/registry.ts` and `docs/openapi.yaml` are untouched.

## Out of Scope

- Adding Sentry to the client bundle (client-side error boundaries).
- Sentry source-map upload (`withSentryConfig` in next.config.ts).
- New routes or API endpoints.
- Log aggregation / shipping (Loki, Datadog, etc.).
- Performance tracing / distributed tracing.
- Log UI in the admin dashboard.
