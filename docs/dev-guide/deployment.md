# Deployment Guide

> For detailed config reference, see [../techstack/deployment.md](../techstack/deployment.md).

The app deploys as a **single Next.js service** (`next-app/`). Primary target is **Zeabur**;
**GCP Cloud Run + Cloud SQL** is the alternate road. The `deploy-config` skill walks both.

## Option A — Zeabur (via Claude Code)

```bash
/athena:deploy production
# Runs the pre-deploy gates automatically → git push → Zeabur → health check
```

### Manual Zeabur Steps

1. Push your repo to GitHub.
2. Create a Zeabur project → Add Service → point at `next-app/` (Zeabur auto-detects Next.js via `zbpack.json`).
3. Set environment variables in the Zeabur dashboard **before** the build (see below).
4. Trigger the deploy.
5. Health check: `curl --fail https://your-app.zeabur.app/api/health`

Migrations run at startup via the package `prestart`/`start` chain (`pnpm db:migrate`).

### Zeabur Config (`next-app/zbpack.json`)

Zeabur reads `next-app/zbpack.json` for Next.js build settings — no Python/uvicorn/alembic.

## Option B — GCP Cloud Run + Cloud SQL

Build the container from `next-app/Dockerfile`, push to Artifact Registry, deploy to Cloud Run,
and attach Cloud SQL (Postgres) via the Cloud SQL connector. `lib/db.ts` lazy-inits the
connection, so the build succeeds without `DATABASE_URL` and the runtime reads it from the
Cloud Run env. See the `deploy-config` skill (Road 2) for the exact CLI steps.

## Environment Variables

| Variable | Purpose | When |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | runtime |
| `AUTH_SECRET` | JWT signing secret (`openssl rand -base64 32`) | runtime |
| `AUTH_URL` / `NEXTAUTH_URL` | canonical app URL | runtime |
| `AUTH_TRUST_HOST` | `true` behind a proxy | runtime |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth (optional) | runtime |
| `PAYMENT_PROVIDER` + provider keys | billing (optional) | runtime |
| `NEXT_PUBLIC_*` | client-exposed config | **build time** |

## `NEXT_PUBLIC_*` Build-Time Warning

Any `NEXT_PUBLIC_*` variable is **baked into the JS bundle at build time**, not read at runtime.
Set it in the platform **before** triggering the build.

- **Zeabur:** set in the dashboard before the build runs.
- **Docker:** pass as a build arg / `.env` consumed at build.

`AUTH_SECRET`, `DATABASE_URL`, and other server-only secrets are read at **runtime** — keep them
out of `NEXT_PUBLIC_*`.

## Pre-deploy Gates

Run from `next-app/` before any deploy (the deploy command runs these for you):

```bash
pnpm typecheck                 # no type errors
pnpm lint                      # eslint clean
pnpm test                      # vitest unit tests pass
pnpm test:coverage             # db-free layer ≥ 80%
git status --porcelain         # clean tree
git branch --show-current      # = main
```

## Rollback

```bash
# Preferred (preserves history)
git revert HEAD && git push origin main

# Emergency only
git reset --hard HEAD~1 && git push --force origin main
```
