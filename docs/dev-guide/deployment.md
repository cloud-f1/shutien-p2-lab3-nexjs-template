# Deployment Guide

> For detailed config reference, see [../techstack/deployment.md](../techstack/deployment.md).

## Option A — Docker Production

```bash
# Use production env (server + client only, no local db/mailpit)
cp .env.production .env
# Edit .env with real DATABASE_URL, SECRET_KEY, etc.

docker compose up --build -d
```

Production containers:
- **Server:** Python + FastAPI, runs `alembic upgrade head` on startup
- **Client:** Multi-stage build (Node build + nginx serve), port 3000
- **Dev Docs:** Multi-stage build (Node build + nginx serve), port 4000

## Option B — Zeabur (via Claude Code)

```bash
/athena:deploy production
# Runs all 6 gates automatically -> git push -> Zeabur -> health check
```

### Manual Deploy Steps

1. Verify all 6 gates pass (see [pre-deploy gates](../techstack/deployment.md#pre-deploy-gates-all-must-pass))
2. `git push origin main` -> GitHub Actions CI/CD triggers Zeabur
3. Server starts: `alembic upgrade head && uvicorn ...`
4. Health check: `curl --fail https://your-server.zeabur.app/health`

### Zeabur Config

```json
// server/zbpack.json
{
  "build_command": "pip install -r requirements.txt",
  "start_command": "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8080"
}
```

```json
// client/zbpack.json
{
  "build_command": "pnpm run build",
  "output_dir": "dist"
}
```

## Pre-deploy Gates

All 6 must pass before deploy:

```bash
cd server && pytest --cov=app --cov-fail-under=80 -q     # >= 80%
cd client && pnpm run test:run -- --coverage               # >= 80%
npx @redocly/cli lint docs/openapi.yaml                   # valid
cd client && pnpm run typecheck                            # no errors
git status --porcelain                                    # clean
git branch --show-current                                 # = main
```

## VITE_API_URL Warning

`VITE_API_URL` is baked into the JS bundle at **build time**, not runtime.
Set it in environment variables BEFORE triggering the client build.

- **Docker:** Set in `.env` or `docker-compose.yml` `build.args`
- **Zeabur:** Set in Zeabur dashboard before triggering rebuild

## Rollback

```bash
# Preferred (preserves history)
git revert HEAD && git push origin main

# Emergency only
git reset --hard HEAD~1 && git push --force origin main
```
