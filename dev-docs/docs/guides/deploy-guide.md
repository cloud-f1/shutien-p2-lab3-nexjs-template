# Deploy Guide

## Deploy to Zeabur

1. Push your repo to GitHub
2. Go to [zeabur.com](https://zeabur.com) → New Project → Add Service → GitHub
3. Select your repo — Zeabur auto-detects Next.js via `zbpack.json`
4. Set env vars (see [Deployment docs](../deployment))
5. Deploy

### Required Env Vars

```env
DATABASE_URL=postgresql://...
AUTH_SECRET=<random 32+ char secret>
NEXTAUTH_URL=https://your-app.zeabur.app
```

### Zero-Downtime Deploys

Migrations run at startup via `prestart`. For large schema changes, use multi-phase migration (backward-compatible column add first, then deploy, then cleanup).

## Deploy dev-docs to Cloudflare Pages

See `deploy/cloudflare-pages.md` for the full config. Short version:

```bash
# Set env var
export CLOUDFLARE_API_TOKEN=<your token>

# Run the gh-cf-deploy skill from Claude Code
/gh-cf-deploy
```

Build settings for Cloudflare Pages:
- **Root:** `dev-docs`
- **Build command:** `pnpm build`
- **Output:** `.vitepress/dist`

### Environment Variables for dev-docs Build

| Var | Purpose |
|-----|---------|
| `VITEPRESS_DEMO_BASE` | Base URL for iframe demos (e.g. `https://app.zeabur.app`) |
| `VITEPRESS_API_BASE` | Base URL for API playground (same as above) |

## Smoke Test After Deploy

```bash
# Health check
curl https://your-app.zeabur.app/api/health
# Expected: { "status": "ok" }

# Sign in
curl -X POST https://your-app.zeabur.app/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!"}'
```
