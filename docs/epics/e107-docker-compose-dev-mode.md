# E107 — Docker Compose Dev Mode (hot-reload)

> Phase 30 — Docker DevOps Maturity | Size: M | Deps: none
> Learned from: ai-casino-shift `docker-compose.yml` dev pattern

## Problem

Current `docker-compose.yml` builds Docker images for server and client — any code change requires a container rebuild. Both sibling projects (ai-casino-shift, ai-finance-management) use source mounts with hot-reload for a seamless Docker-based development experience.

## Solution

Rewrite `docker-compose.yml` as a dev-first compose file:
- **Server**: Mount `./server/app` and `./server/alembic` into the container, run `uvicorn --reload`
- **Client**: Use `node:22-alpine` base image, mount `./client` source, run `pnpm dev --host 0.0.0.0`
- **Named volumes**: `client_node_modules` to avoid host/container platform conflicts
- **Startup**: Server runs `alembic upgrade head` before uvicorn

## Key Files

| File | Action |
|------|--------|
| `docker-compose.yml` | Rewrite server + client services for dev mode |

## Acceptance Criteria

1. `docker compose up` starts db + server + client with hot-reload
2. Editing Python in `server/app/` triggers uvicorn reload without container restart
3. Editing React in `client/src/` triggers Vite HMR without container restart
4. Server runs `alembic upgrade head` on startup before uvicorn
5. Client dev server on port 5173 (matches native `make dev` experience)
6. Named volumes for `node_modules` prevent platform conflicts
7. Mailpit profile and test-db profile still work as before

## Reference

- ai-casino-shift `docker-compose.yml`: source mounts, `uvicorn --reload --reload-dir /app/app`
- ai-finance-management `docker-compose.yml`: similar pattern with `pnpm dev --host 0.0.0.0`

## Notes

- The existing multi-stage `server/Dockerfile` and `client/Dockerfile` remain untouched — they are used by the production compose (E108)
- Dev compose uses lightweight base images with source mounts instead of building
