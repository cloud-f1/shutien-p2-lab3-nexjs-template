# Architecture Decisions

> **Tier 1 Project Memory** · Owner: `@best-practice`

---

## Core Architectural Decisions (inherited from template)

#### GUID TypeDecorator

All tables use UUID v4 primary keys via a custom `GUID` TypeDecorator.
PostgreSQL uses native UUID; SQLite uses CHAR(36). Always returns `uuid.UUID` objects.

#### Stateless JWT Authentication

fastapi-users handles auth with stateless JWT. Access tokens in-memory only (`tokenCache.ts`),
never localStorage. Refresh tokens via httpOnly cookie in production.

#### OpenAPI as Single Source of Truth

All TypeScript types auto-generated from `docs/openapi.yaml` via `openapi-typescript`.
Always edit the spec FIRST, then implement.

#### Email Provider Pattern

Console provider for development, Mailgun for production, auto-detected via environment.
Provider interface in `server/app/core/email/` — swap implementations without code changes.

---

_Add new decisions below as your project evolves._
