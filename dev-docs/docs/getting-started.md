# Getting Started

> Clone → configure → running in **5 minutes**.

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 22+ | `nvm install 22` |
| pnpm | 9+ | `npm i -g pnpm` |
| Docker | 24+ | [docs.docker.com](https://docs.docker.com/get-docker/) |
| PostgreSQL | 15+ | via Docker (recommended) |
| Claude Code | latest | `npm i -g @anthropic-ai/claude-code` (optional, for AI agents) |

## 1. Clone the template

```bash
git clone https://github.com/qwedsazxc78/ai-coding-nexjs-template.git my-saas
cd my-saas
```

## 2. Configure environment

```bash
cp next-app/.env.example next-app/.env.local
```

Required env vars (or let `make local` generate `next-app/.env.local` for you):

```env
# Database
DATABASE_URL=postgresql://saas_user:saas_pass@localhost:5432/saas_dev

# Auth.js v5 (JWT sessions)
AUTH_SECRET=your-random-secret-here   # openssl rand -base64 32
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true

# OAuth (optional)
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
```

> **Fastest path:** `make local-setup` (first time) then `make local` does everything below —
> brings up Docker Postgres + Mailpit, writes `.env.local` with a fresh `AUTH_SECRET`, migrates,
> seeds, and starts the dev server. The manual steps follow.

## 3. Start the database

```bash
# Docker Postgres + Mailpit (infra only)
docker compose up -d postgres mailpit
```

## 4. Install dependencies and run migrations

```bash
cd next-app
pnpm install
pnpm db:generate    # generate Drizzle migrations from lib/schema/*
pnpm db:migrate     # apply migrations (drizzle/migrations/*.sql)
pnpm db:seed        # seed demo users (dev only)
```

## 5. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

**Demo credentials (after seeding):**
- Admin: `admin@example.com` / `Admin123!`
- Editor: `editor@example.com` / `Editor123!`
- Viewer: `viewer@example.com` / `Viewer123!`

## 6. Install a module (optional)

```bash
# Install the landing page module
npx shadcn@latest add @saas/landing

# Install the account settings module
npx shadcn@latest add @saas/account
```

See the [Module Catalog](/modules/) for all available modules.

## Next Steps

- [API Guide](./api-guide) — understand route handlers and Server Actions
- [Module Catalog](/modules/) — browse installable modules
- [AI Agent Team](/docs/guides/ai-agent-team) — automate development with Claude Code
- [Deploy Guide](./deployment) — deploy to Zeabur
