# E255 — Zeabur Deploy Path + Guide

**Phase:** 59 | **Status:** ⬜ | **Depends:** E254

## Problem

Zeabur is the primary deploy target, but the existing `deploy/` assets are stale (GCR + dual FastAPI client/server). There is no current, Next.js-correct Zeabur runbook, and the build-time `NEXT_PUBLIC_*` gotcha is undocumented.

## Solution

Document and validate the Zeabur road (Road 1) for the single `next-app/` service, using the new `zbpack.json`/Dockerfile and the installed Zeabur CLI (0.18.0) + Claude plugin.

## Key Files

- `docs/guides/deployment-zeabur.md` (new) — Road 1 (own file, parallel-safe vs E256)
- `next-app/zbpack.json` (from E254)
- `deploy/README.md` (supersede / point to the new guide)

## Implementation

1. Document creating a Zeabur project + linking the `next-app/` service (Dockerfile or zbpack build).
2. Add a managed **PostgreSQL** service; wire `DATABASE_URL`.
3. Set env: `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST=true`; call out that `NEXT_PUBLIC_*` are baked at **build** time (must be set before build).
4. `zeabur` CLI deploy flow + custom domain mapping.
5. First-deploy migrate/seed note (`pnpm db:migrate`).

## Acceptance Criteria

- [ ] `docs/guides/deployment-zeabur.md` covers project, Postgres, env (build vs runtime), CLI deploy, domain.
- [ ] The build-time `NEXT_PUBLIC_*` gotcha is explicit.
- [ ] `deploy/README.md` no longer presents the stale GCR/dual-service flow as current.

## Out of Scope

- GCP path (E256). Real Zeabur project provisioning (guide is reproducible, not executed here).
