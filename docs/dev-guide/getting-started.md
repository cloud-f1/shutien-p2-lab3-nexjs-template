# Getting Started

This is a single Next.js 16 app under `next-app/` — no separate backend to run.

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 22+ | `nvm install 22` |
| pnpm | 9+ | `npm i -g pnpm` |
| Docker | 24+ | [docs.docker.com](https://docs.docker.com/get-docker/) |
| PostgreSQL | 15+ | via Docker (recommended) |
| Claude Code | latest | `npm i -g @anthropic-ai/claude-code` (optional, for AI agents) |

## Option A — `make local` (Recommended)

One command brings up Docker infra (Postgres + Mailpit) and the Next.js dev server. It also
generates `next-app/.env.local` with a fresh `AUTH_SECRET` if one is missing.

```bash
# First time only — install deps, migrate, seed demo users
make local-setup

# Start: Docker infra + Next.js on http://localhost:3000
make local
```

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Mailpit (email inbox) | http://localhost:8025 |
| PostgreSQL | localhost:5432 |

Stop the infra with `make local-down`.

## Option B — Full Docker

A root `docker-compose.yml` runs the whole stack (Postgres, Mailpit, and the Next.js app) in containers.

```bash
docker compose up --build -d   # app on http://localhost:3000, Mailpit on http://localhost:8025
docker compose down            # stop
```

## Option C — Manual Setup

```bash
cd next-app

pnpm install

# Environment variables (or let `make local-env` generate one for you)
cp .env.example .env.local
# Fill in: DATABASE_URL, AUTH_SECRET, AUTH_URL, (optional) AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET

# Database — generate + apply migrations, then seed demo users
pnpm db:generate     # generate Drizzle migrations from lib/schema/*
pnpm db:migrate      # apply migrations (drizzle/migrations/*.sql)
pnpm db:seed         # seed admin/editor/viewer demo users (dev only)

# Start dev server (port 3000)
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

**Demo logins (after seeding):**
- Admin: `admin@example.com` / `Admin123!`
- Editor: `editor@example.com` / `Editor123!`
- Viewer: `viewer@example.com` / `Viewer123!`

## Environment Variables

Set these in `next-app/.env.local` (server-only secrets are read at runtime; `NEXT_PUBLIC_*` are
baked at build time).

| Variable | Example | Required |
|---|---|---|
| `DATABASE_URL` | `postgresql://saas_user:saas_pass@localhost:5432/saas_dev` | Yes |
| `AUTH_SECRET` | `openssl rand -base64 32` | Yes |
| `AUTH_URL` | `http://localhost:3000` | Yes |
| `AUTH_TRUST_HOST` | `true` (behind a proxy) | Local/proxy |
| `AUTH_GOOGLE_ID` | `xxx.apps.googleusercontent.com` | Google OAuth |
| `AUTH_GOOGLE_SECRET` | `GOCSPX-xxx` | Google OAuth |
| `SMTP_HOST` / `SMTP_PORT` | `localhost` / `1025` (Mailpit) | Email features |
| `EMAIL_FROM` | `noreply@yourdomain.com` | Email features |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Build-time |

## Database Workflow

Schema is defined in TypeScript under `next-app/lib/schema/*`. The Drizzle workflow:

```bash
pnpm db:generate      # diff lib/schema/* → write a new migration to drizzle/migrations/
pnpm db:migrate       # apply pending migrations
pnpm db:seed          # seed demo data
pnpm db:test-migrate  # apply migrations against the test database
pnpm db:studio        # open Drizzle Studio
```

> **Order matters:** edit `lib/schema/*` first, then `db:generate`, then `db:migrate` — never
> hand-write SQL migrations.
