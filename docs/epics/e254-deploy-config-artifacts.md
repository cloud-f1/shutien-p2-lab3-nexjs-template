# E254 — Deploy Config Artifacts

**Phase:** 59 | **Status:** ⬜ | **Depends:** none

## Problem

Deployment was assumed (CLAUDE.md mentions `zbpack.json`) but the config artifacts are missing or stale: `next-app/zbpack.json` does not exist, and there is no single `.env.example` documenting the runtime/build env contract. Both deploy roads (Zeabur, GCP Cloud Run) need the same env matrix.

## Solution

Add the deploy-time config artifacts the two roads share:

- `next-app/zbpack.json` — Zeabur build descriptor pinning the Next.js standalone build/start for the `next-app/` service.
- `next-app/.env.example` — the authoritative env-var matrix (build-time vs runtime annotated).
- Confirm `next-app/Dockerfile` is Cloud-Run-ready (already: `output: "standalone"`, non-root, `PORT`/`HOSTNAME`, `EXPOSE 3000`).

## Key Files

- `next-app/zbpack.json` (new)
- `next-app/.env.example` (new or refreshed)
- `docs/guides/deployment.md` (new) — overview/index linking the two road guides (`deployment-zeabur.md` from E255, `deployment-gcp.md` from E256) + the `make install-deploy-tools` step
- `next-app/Dockerfile` (verify only)
- `next-app/next.config.ts` (verify `output: "standalone"`)

## Implementation

1. Write `zbpack.json` declaring the Node/Next build (`pnpm build`) + start (`node .next/standalone/server.js` or framework default).
2. Write `.env.example` with every var grouped: **build-time** (`NEXT_PUBLIC_*`), **runtime auth** (`AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`), **db** (`DATABASE_URL`), **OAuth** (Google), **email** (SMTP), **billing** (Stripe, ECPay) — each with a one-line comment + safe placeholder.
3. Document the build-time vs runtime split inline (the `NEXT_PUBLIC_*` baked-at-build gotcha).

## Acceptance Criteria

- [ ] `next-app/zbpack.json` exists and `pnpm build` still succeeds.
- [ ] `next-app/.env.example` lists every env var the app + modules read, annotated build vs runtime.
- [ ] Dockerfile confirmed Cloud-Run-ready (documented, no functional change needed).

## Out of Scope

- The deploy guides (E255/E256) and the skill (E257) — this epic only ships the config files.
