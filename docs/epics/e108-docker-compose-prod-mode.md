# E108 — Docker Compose Production Mode

> Phase 30 — Docker DevOps Maturity | Size: M | Deps: E107
> Learned from: ai-casino-shift `docker-compose.prod.yml` pattern

## Problem

After E107 rewrites `docker-compose.yml` for dev mode, there is no compose file for production simulation. Both sibling projects maintain a separate `docker-compose.prod.yml` that builds optimized images and uses production-appropriate settings.

## Solution

Create `docker-compose.prod.yml`:
- **Server**: Build via existing `server/Dockerfile` (multi-stage, uv, non-root user)
- **Client**: Build via existing `client/Dockerfile` (multi-stage, nginx on port 3000)
- **Settings**: DEBUG=false, LOG_FORMAT=json, RATE_LIMIT_AUTH=5/minute
- **Env override**: `${VAR:-default}` syntax for all secrets and config
- **No dev services**: No mailpit, no test-db (clean production surface)

## Key Files

| File | Action |
|------|--------|
| `docker-compose.prod.yml` | New file — production compose |
| `docker-compose.yml` | Update header comment to reference prod file |

## Acceptance Criteria

1. `docker compose -f docker-compose.prod.yml up --build` builds and starts db + server + client
2. Server runs with DEBUG=false, LOG_FORMAT=json, RATE_LIMIT_AUTH=5/minute
3. Client served by nginx on port 3000 (built via existing multi-stage Dockerfile)
4. Health check gates client startup on server readiness (`depends_on: condition: service_healthy`)
5. SECRET_KEY and REFRESH_SECRET_KEY use `${VAR:-fallback}` syntax for host override
6. No mailpit or test-db services in the prod file
7. VITE_API_URL passed as build arg with `__VITE_API_URL_PLACEHOLDER__` for runtime injection

## Reference

- ai-casino-shift `docker-compose.prod.yml`: production settings, built images, nginx client
- Existing `client/docker-entrypoint.sh`: runtime VITE_API_URL replacement already works
