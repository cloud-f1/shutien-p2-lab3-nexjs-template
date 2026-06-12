# Getting Started

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Python | 3.12+ | `pyenv install 3.12` |
| Node.js | 22+ | `nvm install 22` |
| pnpm | 9+ | `npm i -g pnpm` |
| Docker | 24+ | [docs.docker.com](https://docs.docker.com/get-docker/) |
| Claude Code | latest | `npm i -g @anthropic-ai/claude-code` |

## Option A — Docker (Recommended)

The fastest way to get everything running. A single `docker-compose.yml` drives both local dev and production.

```bash
# 1. Copy local env template
cp .env.local .env

# 2. Start all services (db, mailpit, server, client, dev-docs)
docker compose up --build
```

| Service | URL |
|---|---|
| Client | http://localhost:3000 |
| Server | http://localhost:8080 |
| Dev Docs | http://localhost:4000 |
| Mailpit | http://localhost:8025 |
| PostgreSQL | localhost:5432 |

**How it works:** Dev-only services (db, mailpit) use `profiles: [local]`. Setting `COMPOSE_PROFILES=local` in `.env` activates them. In production, that variable is absent so only server and client start.

## Option B — Manual Setup

### Server Setup

```bash
cd server

# Virtual environment
python -m venv .venv && source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Environment variables
cp .env.example .env
# Fill in: DATABASE_URL, SECRET_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

# Run migrations
alembic upgrade head

# Start dev server (port 8080)
uvicorn app.main:app --reload
```

### Client Setup

```bash
cd client

pnpm install

# Environment variables
cp .env.example .env.local
# Fill in: VITE_API_URL=http://localhost:8080

# Generate TypeScript types (run after every openapi.yaml update)
npx openapi-typescript ../docs/openapi.yaml --output src/api/types.ts

# Start dev server (port 5173)
pnpm run dev
```

### Dev Docs Site

```bash
cd dev-docs

pnpm install

# Start dev server (port 4000)
pnpm run dev
```

> **Order matters:** Always update `docs/openapi.yaml` first, then run `openapi-typescript`, then write client or server code.

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
| `SMTP_HOST` | `smtp.resend.com` | Email features |
| `SMTP_USER` | `resend` | Email features |
| `SMTP_PASSWORD` | `re_xxx` | Email features |
| `SMTP_FROM` | `noreply@yourdomain.com` | Email features |

### Client (`client/.env.local`)

| Variable | Example | Note |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8080` | Baked at **build time** |

## Environment Switching

```bash
# Local development (all services including db + mailpit)
cp .env.local .env
docker compose up --build

# Production (server + client only, external db)
cp .env.production .env
# Edit .env with real credentials
docker compose up --build
```

| File | Purpose | Committed? |
|---|---|---|
| `.env.local` | Dev defaults, ready to use | Yes |
| `.env.production` | Prod template with placeholders | Yes |
| `.env` | Active config (copy from above) | No (.gitignored) |
