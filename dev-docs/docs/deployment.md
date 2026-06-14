# Deployment

The @saas template deploys to **Zeabur** as a single Next.js service.

## Zeabur Deployment

### Environment Variables (set in Zeabur before build)

```env
# Required
DATABASE_URL=postgresql://user:pass@host:5432/db
AUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=https://your-app.zeabur.app

# Optional — Sentry observability
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_GIT_SHA=<injected by CI>

# Optional — OAuth
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...

# Optional — Billing
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Deploy Steps

1. Push your repo to GitHub.
2. Create a new Zeabur project → Add Service → GitHub repo.
3. Zeabur auto-detects Next.js via `zbpack.json`.
4. Set environment variables in the Zeabur dashboard.
5. Trigger a deploy.

Migrations run automatically at startup via the `prestart` script:

```json
// next-app/package.json
{
  "scripts": {
    "prestart": "pnpm db:migrate"
  }
}
```

## Cloudflare Pages (dev-docs)

The `dev-docs/` VitePress site deploys to Cloudflare Pages via the `gh-cf-deploy` skill.

```bash
# From repo root (requires CLOUDFLARE_API_TOKEN)
# See deploy/cloudflare-pages.md for setup
```

Build settings:
- **Build command:** `pnpm build`
- **Build output directory:** `dev-docs/.vitepress/dist`
- **Root directory:** `dev-docs`
- **Environment variables:** `VITEPRESS_DEMO_BASE`, `VITEPRESS_API_BASE`

See `deploy/cloudflare-pages.md` for the full deploy configuration.

## Docker

A `docker-compose.yml` is provided for local dev:

```bash
docker compose up -d        # start db + next-app
docker compose down -v      # tear down (loses data)
```

For production Docker, see `next-app/Dockerfile`.
