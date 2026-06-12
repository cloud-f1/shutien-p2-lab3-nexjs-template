# E122 — Nginx PORT Env + DB Connection Adapter

> Phase 32 — Two-Way Deploy | Size: S | Deps: none
> Technical fix: make Dockerfiles work on both Zeabur and Cloud Run without changes

## Problem

Two technical gaps prevent the existing Docker images from working on Cloud Run:

1. **Nginx port**: `client/nginx.conf` hardcodes `listen 3000`. Cloud Run requires listening on `$PORT` (injected at runtime, typically 8080). Zeabur also injects `$PORT` but the hardcoded 3000 happens to match their default.

2. **DB connection**: Cloud SQL uses Unix sockets (`/cloudsql/PROJECT:REGION:INSTANCE`), while Zeabur and external PG use TCP (`postgresql+asyncpg://host:5432/db`). The server needs to handle both without code changes.

## Solution

### 1. Nginx PORT templating

Replace hardcoded `listen 3000` with `listen ${PORT:-3000}` using envsubst in the entrypoint:

```bash
# docker-entrypoint.sh (add before nginx start)
envsubst '${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
```

### 2. DB connection adapter

Add a small helper in `server/app/core/config.py` that detects Cloud SQL Unix socket path:

```python
# If DATABASE_URL contains /cloudsql/, it's Cloud SQL via Unix socket
# Automatically format the asyncpg connection string correctly
```

This is a config-level adapter — no application code changes needed.

## Key Files

| File | Action |
|------|--------|
| `client/nginx.conf` | Template with `${PORT}` variable |
| `client/docker-entrypoint.sh` | Add envsubst for PORT before nginx |
| `client/Dockerfile` | Install envsubst (comes with nginx:alpine) |
| `server/app/core/config.py` | Add Cloud SQL socket detection in DATABASE_URL validator |

## Acceptance Criteria

1. `docker run -e PORT=8080 client` → nginx listens on 8080 (Cloud Run)
2. `docker run client` (no PORT) → nginx listens on 3000 (Zeabur/default)
3. `DATABASE_URL=postgresql+asyncpg://user:pass@/db?host=/cloudsql/proj:region:inst` → connects via Unix socket
4. `DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db` → connects via TCP (unchanged)
5. Existing docker-compose.yml and docker-compose.prod.yml still work (no regression)
