---
name: deploy-config
description: >
  Configure and run a production deploy of this Next.js app on either Road 1
  (Zeabur — primary) or Road 2 (GCP Cloud Run + Cloud SQL). Walks the preflight
  gate, env wiring (build-time vs runtime), the per-road CLI steps, and the
  gotchas (build-time NEXT_PUBLIC_*, JWT AUTH_SECRET, Cloud SQL connector,
  lib/db.ts lazy-init). Use when a user wants to deploy or set up deploy config.
user-invocable: true
---

# Deploy Config Skill

Use this skill to configure + execute a deploy of the `next-app/` service. There are
two supported roads; pick one. Full reproducible runbooks live in
[`docs/guides/deployment.md`](../../../docs/guides/deployment.md) (index) →
`deployment-zeabur.md` (Road 1) and `deployment-gcp.md` (Road 2).

> Tooling: run `make install-deploy-tools` (or `bash scripts/install-deploy-tools.sh`)
> first — it installs the Zeabur Claude plugin (`zeabur@zeabur`) + Zeabur CLI and
> checks `gcloud`/node/pnpm/docker.

---

## Step 0 — Preflight gate (both roads)

Do NOT deploy until all pass:

1. `cd next-app && pnpm build` is green (catches what typecheck+test miss).
2. Migrations are generated and committed (`pnpm db:generate` produced no new diff).
3. `.env` is complete — cross-check every var in `next-app/.env.example` is set in the target.
4. Optional but recommended: `make smoke`.

---

## Pre-deploy readiness gates (fork-safe, always apply)

Beyond the Step 0 preflight, run these before any deploy — all are Critical (blockers)
unless marked Advisory:

| # | Gate | Check |
|---|------|-------|
| 1 | Secrets are real, not placeholders | `AUTH_SECRET` is a random 32+ char value; `DATABASE_URL` points at the real target DB, not localhost |
| 2 | Tests pass | `cd next-app && pnpm test -- --run` and `pnpm test:e2e` both green |
| 3 | Working tree is clean | `git status --porcelain` empty; on the correct branch (`main`/`develop` or your release branch) |
| 4 | Auth flow works end-to-end | After deploy: `curl -sf "$APP/api/auth/session"` returns session JSON (not 500); manual login round-trip against a seed account |
| 5 | Database + demo/seed accounts work | `pnpm db:seed` (dev only — never on stg/prd, see the "Per-env seeding" rule in CLAUDE.md) then verify login |
| 6 | Visual consistency | Landing (`/`), Sign In, Sign Up, Dashboard render correctly in light + dark mode, no hydration mismatch |
| 7 | Branding assets present | `public/favicon.ico`, `public/logo.svg`, `app/layout.tsx` OG image + title metadata all resolve |
| 8 | No stale Docker/image builds | If deploying a prebuilt image, confirm it was rebuilt after the latest commit (`git log -1 --format=%ci` vs image `Created` timestamp) |
| 9 | SEO meta tags (Advisory) | `metadata`/`generateMetadata` present on key routes |
| 10 | Performance baseline (Advisory) | `pnpm build` output — no route unexpectedly >500KB |
| 11 | Rate limiting (Advisory) | Auth endpoints have rate limiting (middleware, platform WAF, or Auth.js built-in protections) |

Gates 2, 5, and the `NEXT_PUBLIC_*`-before-build gotcha overlap with Step 0 and the
Gotchas section below — don't re-derive them, just don't skip them.

---

## Step 1 — Choose the road

| | Road 1 — **Zeabur** (primary) | Road 2 — **GCP Cloud Run + Cloud SQL** |
|---|---|---|
| Build | `zbpack.json` / Dockerfile | Dockerfile → Artifact Registry |
| DB | Zeabur managed PostgreSQL | Cloud SQL Postgres + connector |
| Secrets | Zeabur env vars | Secret Manager (`--set-secrets`) |
| CLI | `zeabur` + `zeabur@zeabur` plugin | `gcloud` |
| Runbook | `docs/guides/deployment-zeabur.md` | `docs/guides/deployment-gcp.md` |

---

## Step 2 — Road 1: Zeabur

1. Create a Zeabur project; add the `next-app/` service (Dockerfile or zbpack build).
2. Add a managed **PostgreSQL** service → wire `DATABASE_URL`.
3. Set runtime env: `AUTH_SECRET` (strong random), `AUTH_URL` (the deployed URL),
   `AUTH_TRUST_HOST=true`.
4. ⚠️ Set every `NEXT_PUBLIC_*` **before the build** — they are baked at build time and
   cannot be changed at runtime.
5. Deploy via the `zeabur` CLI (or the `zeabur@zeabur` plugin for guided steps); map a
   custom domain; run `pnpm db:migrate` once against the managed DB.

## Step 2 — Road 2: GCP Cloud Run + Cloud SQL

Use `${PROJECT_ID}` / `${REGION}` / `${INSTANCE}` placeholders — fill in your own.

1. `gcloud config set project ${PROJECT_ID}`; enable `run`, `sqladmin`,
   `artifactregistry`, `secretmanager` APIs.
2. Build + push the image (Artifact Registry) or `gcloud run deploy --source .`.
3. Create the Cloud SQL Postgres instance `${INSTANCE}`; attach to Cloud Run via
   `--add-cloudsql-instances ${PROJECT_ID}:${REGION}:${INSTANCE}` and build the unix-socket
   `DATABASE_URL`.
4. Put `AUTH_SECRET` + `DATABASE_URL` in Secret Manager → `--set-secrets`.
5. Bake `NEXT_PUBLIC_*` at build time (`--build-arg` / Cloud Build substitutions).
6. Run migrate/seed once as a Cloud Run **Job** off the same image.
7. Map a custom domain; set `AUTH_URL` + `AUTH_TRUST_HOST=true`.

---

## Gotchas (the ones that bite)

- **Build-time `NEXT_PUBLIC_*`** — baked into the bundle at `next build`. Set them before
  building; changing them at runtime does nothing.
- **JWT `AUTH_SECRET`** — Auth.js v5 Credentials uses JWT sessions; a missing/rotated
  `AUTH_SECRET` invalidates all sessions. Use one strong secret per environment.
- **Cloud SQL connector** — Cloud Run reaches Cloud SQL over a unix socket at
  `/cloudsql/${PROJECT_ID}:${REGION}:${INSTANCE}`, not TCP. Build `DATABASE_URL` accordingly.
- **`lib/db.ts` lazy-init** — it throws if `DATABASE_URL` is unset *at import*, which
  `next build` triggers during page-data collection. Provide a placeholder `DATABASE_URL`
  at build time (the postgres client still connects lazily — no DB is contacted at build).
- **`output: "standalone"`** — already set; the runner serves `node server.js`. Static
  assets (`.next/static`, `public/`) are copied separately (see Dockerfile).

---

## Done

After deploy: verify `/` and a protected route, confirm a login round-trip (JWT), and
check the DB migration ran. Record the URL + env in your own ops notes.
