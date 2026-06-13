# AI Coding Template (Next.js) — Tech Stack Summary

> **Next.js 16 · React 19 · Drizzle · PostgreSQL · shadcn/ui**
> App Router + Server Actions + Auth.js v5
> Upload this file to restore full context in any Claude session.

---

## Quick Reference

### Stack

| Layer | Tech | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | React Server Components + Server Actions |
| Language | TypeScript 5.x | Strict mode; path alias `@/*` → `next-app/` root |
| UI | React 19 | `useActionState`, `useOptimistic`, form `action` prop |
| Styling | Tailwind CSS v4 | `dark:` variants; no inline `style=` colors |
| Components | shadcn/ui (Radix UI) | Generated into `components/ui/`; never hand-edited |
| ORM | Drizzle + drizzle-kit | SQL-first; schema in `lib/schema.ts` |
| DB | PostgreSQL 15 | UUID PKs; Drizzle migrations in `drizzle/migrations/` |
| Auth | Auth.js v5 (NextAuth) | Drizzle adapter; edge-compatible session |
| Theme | next-themes | Class strategy; toggle: `d` key |
| Deploy | Zeabur | Single `next-app/` service |

### Non-Negotiable Rules

1. **Default to Server Components** — add `"use client"` only for event handlers / hooks
2. **`@/*` path alias** — never use relative `../../` imports
3. **shadcn/ui via CLI only** — `npx shadcn@latest add <name>`; never hand-edit `components/ui/`
4. **`cn()` for all conditional classes** — never string concatenation
5. **Server Actions for mutations** — `"use server"` in `actions/*.ts`
6. **Auth.js session on server** — always `await auth()` for server-side user identity; never trust client payload
7. **URL as state** — filters / pagination in `searchParams`, not `useState`
8. **No new page-level CSS files** — compose `components/ui/` primitives with Tailwind

### Project Structure

```
next-app/
├── app/
│   ├── (auth)/          login/, register/, layout.tsx
│   ├── (dashboard)/     dashboard/, layout.tsx (sidebar)
│   ├── api/auth/[...nextauth]/route.ts
│   ├── layout.tsx       root layout: fonts + ThemeProvider
│   └── globals.css
├── actions/             Server Actions ("use server")
├── components/
│   ├── ui/              shadcn/ui (generated)
│   └── *.tsx            shared Client/Server components
├── lib/
│   ├── auth.ts          Auth.js config + session helper
│   ├── db.ts            Drizzle client singleton
│   ├── schema.ts        Drizzle table definitions
│   └── utils.ts         cn()
├── drizzle/migrations/  Generated SQL migrations
├── drizzle.config.ts
└── middleware.ts        Edge route guard
```

### Auth Design

| Concern | Implementation |
|---|---|
| Session storage | Auth.js database sessions (stored in DB via Drizzle adapter) |
| Route protection | `middleware.ts` — edge-level redirect before page renders |
| Server identity | `await auth()` in Server Components / Server Actions |
| Client identity | `useSession()` in Client Components (next-auth/react) |
| OAuth providers | Configured in `lib/auth.ts` |

### Drizzle Schema (Core Tables)

```ts
users            id (UUID), name, email, emailVerified, image
accounts         Auth.js OAuth accounts
sessions         Auth.js database sessions
verificationTokens  Email verification
// Domain tables added per feature in lib/schema.ts
```

### Key Commands

```bash
# Development (run from next-app/)
pnpm dev               # http://localhost:3000
pnpm build
pnpm lint
pnpm typecheck         # tsc --noEmit
pnpm format

# Drizzle migrations (run from next-app/)
pnpm drizzle-kit generate   # generate SQL from schema changes
pnpm drizzle-kit migrate    # apply to DB
pnpm drizzle-kit studio     # GUI at https://local.drizzle.studio

# Add shadcn component
npx shadcn@latest add <component>
```

### Required Packages (install if missing)

```bash
pnpm add drizzle-orm postgres next-auth@beta @auth/drizzle-adapter
pnpm add -D drizzle-kit
```

### Environment Variables

```bash
# next-app/.env.local
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
AUTH_SECRET=<generate: openssl rand -base64 32>
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

---

## Detailed Docs

| Topic | File |
|---|---|
| Architecture + project structure | [docs/techstack/architecture.md](docs/techstack/architecture.md) |
| Next.js background concepts | [docs/nextjs-background.md](docs/nextjs-background.md) |
| Next.js best practices | [docs/nextjs-best-pratice.md](docs/nextjs-best-pratice.md) |
| Layout guide + page structure | [docs/nextjs-layout.md](docs/nextjs-layout.md) |
| Agent team + memory system | [docs/techstack/agents-memory.md](docs/techstack/agents-memory.md) |

---

*AI Coding Template (Next.js) · Tech Stack Summary · v4.0.0*
*Detailed docs in docs/techstack/ · Agent memory in docs/context/*
