# E226 — Dockerize next-app (local run)

**Phase:** 54 | **Status:** 🔄 | **Depends:** E223, E224, E225

## Problem

The old `client/Dockerfile` + root `docker-compose` reference the deleted Vite/FastAPI stack. There is no way to run the Next.js app in Docker. Goal: `docker compose up` serves the finished UI locally.

## Solution

- `next.config.ts`: `output: "standalone"` for a lean runtime image.
- `next-app/Dockerfile`: multi-stage (deps → build → standalone runner on node:22-alpine), non-root, `PORT=3000`.
- `docker-compose.yml` (new, next-app-focused): `postgres` service + `web` (build from next-app) with `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`/`AUTH_TRUST_HOST`; a one-shot migrate+seed step (or entrypoint) so the DB is ready.
- `.dockerignore` for next-app (node_modules, .next, e2e artifacts).
- Verify: `docker compose up --build` → probe `/api/health`, `/login`; capture a screenshot of the dashboard to confirm it renders like the reference images.

## Acceptance

- [ ] `docker compose up --build` boots web + postgres, migrations + seed applied
- [ ] `/login` renders login-01 look; after login the dashboard-01 UI shows
- [ ] App reachable at http://localhost:3000 with working auth/RBAC
