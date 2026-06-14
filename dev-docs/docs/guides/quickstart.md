# Quick Start Guide

> Full path from clone to first epic. Takes ~5 minutes.

## Step 1: Clone and install

```bash
git clone https://github.com/qwedsazxc78/ai-coding-nexjs-template.git my-saas
cd my-saas/next-app
pnpm install
```

## Step 2: Configure database

```bash
# Start Postgres via Docker
docker compose up -d db

# Copy env template
cp .env.example .env.local
# Edit .env.local: set DATABASE_URL, AUTH_SECRET, NEXTAUTH_URL
```

## Step 3: Run migrations and seed

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed        # creates test users for e2e
```

## Step 4: Start dev server

```bash
pnpm dev
# → http://localhost:3000
```

## Step 5: Install a module

```bash
# Landing page
npx shadcn@latest add @saas/landing

# Account settings
npx shadcn@latest add @saas/account
```

## Step 6: Run quality checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```

## What's next?

- Browse the [Module Catalog](/modules/) to install more features
- Set up the [AI Agent Team](/docs/guides/ai-agent-team) for automated development
- Follow the [First Epic Walkthrough](/docs/guides/first-epic) to build a new feature
