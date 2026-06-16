# Quickstart / 快速入門

> From clone to a running app in as few as **two commands**.
> 也提供雙語版本：**[English content below](#fastest-start-docker)** · **[繁體中文](zh-TW/quickstart.md)**

---

## Fastest Start: Docker

The whole stack — PostgreSQL, migrate + seed, the Next.js web app (and mailpit for email
capture) — boots from one command:

```bash
git clone https://github.com/cloud-f1/ai-coding-nexjs-template.git
cd ai-coding-nexjs-template
docker compose up --build -d
```

Then open:

- App — http://localhost:3000
- Mailpit (captured emails) — http://localhost:8025

The seed creates three demo logins (3-tier RBAC):

| Role | Email | Password |
|------|-------|----------|
| admin | `admin@example.com` | `Admin123!` |
| editor | `editor@example.com` | `Editor123!` |
| viewer | `viewer@example.com` | `Viewer123!` |

---

## Alternative: `make local`

Run Postgres in Docker but the Next.js dev server on your host (faster hot-reload):

```bash
make local        # boots local infra (Postgres) + `pnpm dev` on http://localhost:3000
```

---

## Alternative: run the app directly

All app commands run from `next-app/`:

```bash
cd next-app
pnpm install

# Set DATABASE_URL + AUTH_SECRET (see .env.example).
# AUTH_SECRET signs the JWT session — generate one with: openssl rand -base64 32

pnpm db:migrate      # apply Drizzle (drizzle-kit) migrations
pnpm db:seed         # seed the three demo users above
pnpm dev             # http://localhost:3000
```

**Requirements:** Node.js >= 20 · pnpm >= 9 · PostgreSQL >= 15 (or Docker) · Git.

---

## Everyday commands (from `next-app/`)

```bash
pnpm dev            # dev server
pnpm build          # production build
pnpm lint           # ESLint (eslint-config-next)
pnpm typecheck      # tsc --noEmit
pnpm format         # prettier --write

pnpm test           # Vitest unit tests (lib/validations, lib/is-admin, actions)
pnpm test:coverage  # Vitest with v8 coverage
pnpm test:e2e       # Playwright e2e (needs a seeded DB + dev server)

pnpm db:generate    # regenerate a Drizzle migration after a schema change
pnpm db:migrate     # apply migrations
pnpm db:seed        # reseed the demo users

# Add a shadcn/ui component (never hand-author files in components/ui/)
npx shadcn@latest add <component-name>
```

---

## What you're looking at

A **single Next.js 16 app** (App Router + React 19 + TypeScript + Tailwind v4 + shadcn/ui):

- **Auth** — Auth.js v5 Credentials with **JWT sessions** (`lib/auth.ts`, edge guard in `proxy.ts`).
  Login / register pages live under `app/(auth)/`.
- **Dashboard** — shadcn `sidebar-01` + `dashboard-01` shell under `app/(dashboard)/`.
- **RBAC** — 3 tiers (admin / editor / viewer); guards **re-read the role from the DB**
  (`lib/permissions.ts`). Sign in as each demo user to see what changes.
- **Data** — Drizzle ORM (`lib/schema/*`), shared Zod validations (`lib/validations/*`),
  mutations via Server Actions (`actions/*.ts`).

---

## Next steps

1. **[First Epic Walkthrough](first-epic-walkthrough.md)** (~30 min) — build a feature end to
   end: a Drizzle table + Zod + Server Action + dashboard page.
2. [EPIC_INDEX.md](../epics/EPIC_INDEX.md) — current development progress.
3. [TECHSTACK.md](../../TECHSTACK.md) — the full architecture.

---

## 快速入門（繁體中文）

完整中文步驟見 **[繁體中文版 Quickstart](zh-TW/quickstart.md)**。最短路徑：

```bash
git clone https://github.com/cloud-f1/ai-coding-nexjs-template.git
cd ai-coding-nexjs-template
docker compose up --build -d        # http://localhost:3000（mailpit 於 :8025）
```

Demo 登入：`admin@example.com / Admin123!` · `editor@example.com / Editor123!` ·
`viewer@example.com / Viewer123!`。
