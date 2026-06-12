# Deployment Guide

- **GitHub**: https://github.com/cloud-f1/ai-coding-template
- **GCR Registry**: `asia-east1-docker.pkg.dev/common-411213`
- **Zeabur Template**: https://zeabur.com/templates/N8Y5Q5

| Env | Client | API Server | GCR Repo |
|-----|--------|------------|----------|
| dev | `dev-coding-template.zeabur.app` | `dev-coding-template-api.zeabur.app` | `dev-app/ai-coding-template-*:dev` |
| prd | `coding-template.zeabur.app` | `coding-template-api.zeabur.app` | `prd-app/ai-coding-template-*:prd` |

## Architecture

```
GitHub Actions (CI)          Local (manual)
  main push → dev-app:dev      bash deploy/docker-push.sh
  prd push  → prd-app:prd      bash deploy/docker-push.sh prd
         ↓                              ↓
   Google Artifact Registry (asia-east1-docker.pkg.dev/common-411213)
         ↓
   Zeabur (template deploy)
     ├── postgresql (postgres:16-alpine)
     ├── server (ai-coding-template-server:dev)
     └── client (ai-coding-template-client:dev)
```

## Docker Images

| Branch | Registry | Tag |
|--------|----------|-----|
| `main` | `asia-east1-docker.pkg.dev/common-411213/dev-app/ai-coding-template-server` | `dev` |
| `main` | `asia-east1-docker.pkg.dev/common-411213/dev-app/ai-coding-template-client` | `dev` |
| `prd` | `asia-east1-docker.pkg.dev/common-411213/prd-app/ai-coding-template-server` | `prd` |
| `prd` | `asia-east1-docker.pkg.dev/common-411213/prd-app/ai-coding-template-client` | `prd` |

Only changed services are built (`server/**` or `client/**` path filtering).

## Domains

| Env | Client | API Server |
|-----|--------|------------|
| dev | `dev-coding-template.zeabur.app` | `dev-coding-template-api.zeabur.app` |
| prd | `coding-template.zeabur.app` | `coding-template-api.zeabur.app` |

## Scripts

| Script | Description |
|--------|-------------|
| `deploy/docker-push.sh` | Build amd64 images & push to GCR. `VITE_API_URL` baked per env. |
| `deploy/docker-push.sh prd` | Same for production |
| `deploy/zeabur-update.sh` | Push Zeabur template updates (set template ID after first create) |
| `deploy/deploy-zeabur.sh` | Full interactive Zeabur deploy (env vars, domains, smoke test) |

## Deploy Checklist

1. **Build & push images**: `bash deploy/docker-push.sh`
2. **Redeploy services** on Zeabur dashboard (pull new image)
3. **Smoke test**: `curl https://dev-coding-template-api.zeabur.app/health`

## Environment Variables

### Server (required)

| Variable | Example | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host:5432/db` | PostgreSQL connection string |
| `SECRET_KEY` | `openssl rand -hex 32` | JWT signing key |
| `REFRESH_SECRET_KEY` | `openssl rand -hex 32` | Refresh token key (must differ from SECRET_KEY) |
| `ENVIRONMENT` | `production` | `production` or `development` |
| `ALLOWED_ORIGINS_STR` | `https://dev-coding-template.zeabur.app` | Comma-separated CORS origins |

### Server (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | JWT access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` | Refresh token TTL |
| `DB_POOL_SIZE` | `20` | Connection pool size |
| `DB_MAX_OVERFLOW` | `30` | Max overflow connections |
| `SENTRY_DSN` | (empty) | Sentry error tracking DSN |
| `LOG_FORMAT` | `console` | `console` or `json` |
| `RATE_LIMIT_AUTH` | `15/minute` | Auth endpoint rate limit |
| `GOOGLE_CLIENT_ID` | (empty) | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | (empty) | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | (empty) | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | (empty) | GitHub OAuth client secret |
| `EMAIL_PROVIDER` | `console` | Email provider (`console`, `zeabur`) |

### Client (build-time)

| Variable | Dev | Prd |
|----------|-----|-----|
| `VITE_API_URL` | `https://dev-coding-template-api.zeabur.app` | `https://coding-template-api.zeabur.app` |

**Important**: `VITE_API_URL` is baked at Docker build time via `--build-arg`. The `docker-entrypoint.sh` also supports runtime override via sed replacement of the placeholder.

## GitHub Secrets

| Secret | Description |
|--------|-------------|
| `GCP_SERVICE_ACCOUNT` | GCP service account JSON key (for `credentials_json` auth) |

## Zeabur Template

- **Template URL**: https://zeabur.com/templates/N8Y5Q5
- **Template ID**: `N8Y5Q5`
- **Update command**: `bash deploy/zeabur-update.sh`

The template references `${GCR_JSON_KEY}` in `imagePullCredentials` for both server and client services.
This secret is **not** included as a template variable — set it manually in the Zeabur project dashboard
so Zeabur can pull private Docker images from GCR (username: `_json_key`, password: the GCP service account JSON).

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@test.com` | `Admin#Pass1` |
| User | `user@test.com` | `User#Pass1` |

## Troubleshooting

### Server health check fails (connection refused)
- **Cause**: Alembic migration fails because PostgreSQL isn't ready yet
- **Fix**: Dockerfile has retry loop (5 attempts, 5s delay). If still failing, check DB connectivity.

### 405 Method Not Allowed on login
- **Cause**: `VITE_API_URL` points to client domain instead of API server domain
- **Fix**: Ensure `VITE_API_URL` is set to the API server URL, not the client URL

### CORS errors
- **Cause**: `ALLOWED_ORIGINS_STR` doesn't include the client domain
- **Fix**: Set to exact client URL (e.g., `https://dev-coding-template.zeabur.app`)

### Mac builds fail on Zeabur/GKE
- **Cause**: Mac builds ARM images by default, Zeabur runs amd64
- **Fix**: `docker-push.sh` uses `docker buildx build --platform linux/amd64`
