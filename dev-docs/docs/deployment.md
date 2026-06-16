# Deployment

The template deploys as a **single Next.js service** (`next-app/`). Primary target is **Zeabur**;
**GCP Cloud Run + Cloud SQL** is the alternate road. The `deploy-config` skill walks both.

## Zeabur Deployment

### Environment Variables (set in Zeabur before build)

```env
# Required (runtime)
DATABASE_URL=postgresql://user:pass@host:5432/db
AUTH_SECRET=<openssl rand -base64 32>
AUTH_URL=https://your-app.zeabur.app
AUTH_TRUST_HOST=true

# Optional — build-time (baked into the bundle)
NEXT_PUBLIC_APP_URL=https://your-app.zeabur.app
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...

# Optional — OAuth
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...

# Optional — Billing
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

> **`NEXT_PUBLIC_*` are baked at build time** — set them in the Zeabur dashboard *before* the
> build runs. `AUTH_SECRET`, `DATABASE_URL`, and other secrets are read at runtime; keep them out
> of `NEXT_PUBLIC_*`.

### Deploy Steps

1. Push your repo to GitHub.
2. Create a Zeabur project → Add Service → point at `next-app/`.
3. Zeabur auto-detects Next.js via `next-app/zbpack.json`.
4. Set environment variables in the Zeabur dashboard.
5. Trigger a deploy. Health check: `https://your-app.zeabur.app/api/health`.

Migrations run automatically at startup via the package `start`/`prestart` chain (`pnpm db:migrate`).

## GCP Cloud Run + Cloud SQL

Build from `next-app/Dockerfile`, push to Artifact Registry, deploy to Cloud Run, and attach
Cloud SQL (Postgres) via the Cloud SQL connector. `lib/db.ts` lazy-inits the connection so the
build succeeds without `DATABASE_URL` — the runtime reads it from the Cloud Run env. See the
`deploy-config` skill (Road 2) for the CLI walkthrough.

## Cloudflare Pages (dev-docs)

The `dev-docs/` VitePress site deploys to Cloudflare Pages via the `gh-cf-deploy` skill.

Build settings:
- **Build command:** `pnpm build`
- **Build output directory:** `.vitepress/dist`
- **Root directory:** `dev-docs`
- **Environment variables:** `VITEPRESS_DEMO_BASE`, `VITEPRESS_API_BASE` (point the live demo
  iframes + API playground at your deployed Next.js app)

## Docker

A root `docker-compose.yml` runs the whole stack (Postgres, Mailpit, Next.js app) locally:

```bash
docker compose up --build -d   # app on http://localhost:3000, Mailpit on http://localhost:8025
docker compose down            # stop (add -v to drop the db volume)
```

For production Docker, build `next-app/Dockerfile` directly.
