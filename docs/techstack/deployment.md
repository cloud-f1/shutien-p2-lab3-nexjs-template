# Deployment — Zeabur

## Environment Variables

### Server (`server/.env`)

| Variable | Example | Required |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@localhost/db` | Yes |
| `SECRET_KEY` | `openssl rand -hex 32` | Yes |
| `GOOGLE_CLIENT_ID` | `xxx.apps.googleusercontent.com` | Yes |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxx` | Yes |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Yes |
| `DEBUG` | `true` (dev) / `false` (prod) | Yes |
| `SMTP_HOST` | `smtp.resend.com` | Email feature |
| `SMTP_USER` | `resend` | Email feature |
| `SMTP_PASSWORD` | `re_xxx` | Email feature |
| `SMTP_FROM` | `noreply@yourdomain.com` | Email feature |

### Client (`client/.env.local`)

| Variable | Example | Note |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8080` | Baked at **build time**, not runtime |

> `VITE_API_URL` is bundled into JS at build time. Set it in Zeabur BEFORE triggering the client build.

## Pre-deploy Gates (all must pass)

```bash
cd server && pytest --cov=app --cov-fail-under=80 -q     # >= 80%
cd client && pnpm run test:run -- --coverage               # >= 80%
npx @redocly/cli lint docs/openapi.yaml                   # valid
cd client && pnpm run typecheck                            # no errors
git status --porcelain                                    # clean
git branch --show-current                                 # = main
```

## Deploy Flow

```bash
# 1. Push triggers GitHub Actions CI/CD
git push origin main

# 2. Zeabur auto-deploys (webhook from GitHub Actions)

# Server startup command:
# alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8080

# 3. Health check (wait 30s for Zeabur startup)
sleep 30 && curl --fail https://your-server.zeabur.app/health
```

## Zeabur Config

```json
// server/zbpack.json
{
  "build": "pip install -r requirements.txt && alembic upgrade head",
  "start": "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
}

// client/zbpack.json
{
  "build": "pnpm install && pnpm run build",
  "output": "dist"
}
```

## Rollback

```bash
# Preferred: git revert (preserves history)
git revert HEAD && git push origin main

# Emergency: hard reset (use with caution)
git reset --hard HEAD~1 && git push --force origin main
```
