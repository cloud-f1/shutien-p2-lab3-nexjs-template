# E41 — Zero-Config Dev Startup (`make go`)

> **Size**: M (13 SP) | **Priority**: P0 | **Phase**: 16
> **Dependencies**: none

---

## Problem Statement

A first-time user must execute 9 sequential steps across 3 directories with 6 prerequisite tools to get the app running. Competitors achieve this in 1-2 steps. The automation already exists (`make setup`, `make dev`) but is not the documented happy path.

## Stories

### S1: `make go` — Single Command Startup
**As a** first-time developer
**I want** to run one command and see the app
**So that** I can evaluate the template without reading extensive docs

**Acceptance Criteria**:
- [ ] `make go` checks prerequisites (Node, pnpm, Python, uv) with friendly error messages
- [ ] Auto-copies `.env.example` → `.env` if missing
- [ ] Auto-generates `SECRET_KEY` and `REFRESH_SECRET_KEY` via `openssl rand -hex 32`
- [ ] Starts PostgreSQL via `docker compose --profile local up -d db` if not running
- [ ] Runs `alembic upgrade head` for migrations
- [ ] Runs `pnpm generate:types` for TypeScript types
- [ ] Starts server + client in parallel
- [ ] Prints a clear "Ready! Open http://localhost:5173" message

### S2: Docker-Only Dev Path
**As a** developer who only has Docker installed
**I want** `docker compose --profile dev up` to start everything
**So that** I don't need to install Python, Node, or any other tools locally

**Acceptance Criteria**:
- [ ] New `dev` profile in `docker-compose.yml` includes db + server + client
- [ ] Server entrypoint runs migrations before starting uvicorn
- [ ] Client dev container serves with hot-reload (volume mount)
- [ ] Works out of the box with zero env file editing

### S3: Fix Version Inconsistencies
**Acceptance Criteria**:
- [ ] `docs/guides/quickstart.md` says Node >= 22 (matches `.nvmrc` and `package.json`)
- [ ] Port references unified: dev = `:5173` (Vite), Docker = `:3000` (nginx)
- [ ] `pnpm new-site` next-steps message matches quickstart guide

### S4: Prerequisite Checker Script
**Acceptance Criteria**:
- [ ] `scripts/check-prereqs.sh` validates: git, node (>=22), pnpm, python (>=3.12), uv, docker
- [ ] Each missing tool shows install instructions (brew/apt/official URL)
- [ ] Called by `make go` before any other step
- [ ] Exit code 0 = all good, 1 = missing tools (lists which)

## Technical Notes

- `Makefile` already has `setup` and `dev` targets — extend, don't replace
- `make go` = `check-prereqs` → `setup` → `migrate` → `generate-types` → `dev`
- Docker dev profile should use volume mounts for hot-reload, not COPY
- Keep `make setup` and `make dev` as separate targets for advanced users

## Risk Notes

- Docker volume mounts on macOS can be slow — document `mutagen` as optional speedup
- `openssl rand` may not be available on all systems — fallback to Python `secrets.token_hex(32)`
