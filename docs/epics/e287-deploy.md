# E287 — Deploy path fix (fork-ability)

> Phase 67 (Fork-ability) · deploy · branch `feat/E287-deploy`
> Source: the 2026-06 fork-readiness audit (F20, F21, F22).

## Problem

The deploy artifacts still targeted the removed FastAPI 2-service stack, so a first-timer
following the docs could not reach a working deployment:
- **F20** — `deploy/deploy-zeabur.sh` `cd`s into a non-existent `server/`, sets `VITE_API_URL`
  on a "client" service, and generates FastAPI-era `SECRET_KEY`/`REFRESH_SECRET_KEY` (not `AUTH_SECRET`).
  `deploy-guide.md` referenced a non-existent `make docker-prod`.
- **F21** — the GCP guide seeded `db/seed.ts` (real path: `drizzle/seed.ts`) and ran `drizzle-kit`/`tsx`
  in the deployed **runner** image, which is the Next standalone build with no devDependencies → migrate/seed
  jobs fail, app boots but every query 500s.
- **F22** — `NEXT_PUBLIC_APP_URL` (build-time, consumed by emails + ECPay callbacks) baked `localhost` because
  the Dockerfile declared no such ARG.

## Solution

- **`deploy/deploy-zeabur.sh`** — rewritten for the Next.js **single `web` service** (no server/client split,
  no `VITE_API_URL`); generates `AUTH_SECRET` via `openssl rand -base64 32`; sets `DATABASE_URL`/`AUTH_URL`/
  `AUTH_TRUST_HOST`/`NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false`/SMTP/optional STRIPE_*/ECPAY_*.
  `deploy/config.json` + `deploy/zeabur-template.yaml` collapsed to the single-service schema.
- **`next-app/Dockerfile`** — added `ARG NEXT_PUBLIC_APP_URL` + `ENV` in the builder stage before `pnpm build`
  (so the `--build-arg NEXT_PUBLIC_APP_URL` the GCP guide passes now maps to a real ARG).
- **`docs/guides/deployment-gcp.md`** — seed path → `drizzle/seed.ts`; migrate/seed jobs now build + use the
  Dockerfile **builder** target (has drizzle-kit + tsx) via `pnpm db:migrate` / `pnpm db:seed`, mirroring the
  compose `migrate` service. **`docs/guides/deployment-zeabur.md`** — added `NEXT_PUBLIC_APP_URL` to the
  build-time env table + the runner-image devDeps migration caveat.
- **`docs/guides/{en,zh-TW}/deploy-guide.md`** — `make docker-prod` → `make docker-up`.

## Acceptance Criteria

- [x] The Zeabur deploy script + template describe a single Next.js service (no `server/`/`VITE_API_URL`).
- [x] `NEXT_PUBLIC_APP_URL` is a declared Dockerfile build ARG.
- [x] GCP migrate/seed uses an image that contains drizzle-kit/tsx + the correct seed path.
- [x] `bash -n` clean; config.json valid JSON; zeabur-template.yaml valid YAML.

## Out of Scope

- A fully scripted GCP deploy (the guide remains step-by-step gcloud). Production-grade Cloud SQL connector
  wiring is documented, not automated.
