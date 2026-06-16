# Architecture Overview

## System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    NEXT.JS APP (next-app/)                   │
│                                                              │
│  React 19 · App Router · TypeScript                          │
│  Server Components (default) + Client Components             │
│                                                              │
│  ┌───────────────┐    ┌─────────────────────────────────┐   │
│  │ Server Actions │    │ Route Handlers (app/api/)       │   │
│  │ actions/*.ts  │    │ auth · health · billing webhooks │   │
│  └───────┬───────┘    └───────────────┬─────────────────┘   │
│          │                            │                       │
│          └──────────┬─────────────────┘                      │
│                     │ Drizzle ORM (postgres-js)              │
├─────────────────────┼──────────────────────────────────────-─┤
│                     ▼                                        │
│                  PostgreSQL                                  │
│   users · accounts · items · billing · system tables         │
└──────────────────────────────────────────────────────────────┘

Edge: proxy.ts → auth check → redirect / allow
```

**Design Principle:** Next.js is the full-stack boundary. There is no FastAPI/Vite split — Server Components and Server Actions talk directly to PostgreSQL via Drizzle. No separate API server; Auth.js v5 (JWT sessions) handles authentication.

---

## Two-Tier Memory System

| Tier | Location | Contains | Owner |
|---|---|---|---|
| Tier 0 — Template | `~/.claude/template-memory/` | Cross-project wisdom | `@memory-curator` |
| Tier 1 — Project | `docs/context/` | This project's state | All agents |

---

## Project Structure

```
ai-coding-nexjs-template/
│
├── CLAUDE.md                    ← Session identity
├── TECHSTACK.md                 ← Upload to restore any Claude session
│
├── docs/
│   ├── nextjs-background.md     ← App Router concepts
│   ├── nextjs-best-pratice.md   ← Patterns for this stack
│   ├── nextjs-layout.md         ← Folder structure + architecture guide
│   ├── techstack/               ← Detailed tech decisions (this dir)
│   ├── epics/                   ← Epic progress tracking
│   ├── specs/                   ← Feature implementation plans
│   └── context/                 ← Agent memory write-backs
│
├── next-app/                    ← Next.js 16 application
│   ├── app/
│   │   ├── (auth)/              ← Login / Register pages
│   │   ├── (dashboard)/         ← Protected dashboard routes
│   │   ├── api/auth/[...nextauth]/ ← Auth.js endpoints
│   │   ├── layout.tsx           ← Root layout: fonts + ThemeProvider
│   │   └── globals.css
│   ├── actions/                 ← Server Actions ("use server")
│   ├── components/
│   │   ├── ui/                  ← shadcn/ui (generated via CLI)
│   │   └── *.tsx                ← Shared components
│   ├── lib/
│   │   ├── auth.ts              ← Auth.js config (JWT) + session helper
│   │   ├── permissions.ts      ← requireAuth/requireAdmin (re-reads role from DB)
│   │   ├── is-admin.ts         ← client-safe role booleans
│   │   ├── db.ts                ← Drizzle client (lazy-init, postgres-js)
│   │   ├── schema/             ← Drizzle tables (auth/items/billing/system + index.ts)
│   │   ├── validations/        ← shared Zod schemas
│   │   └── utils.ts             ← cn() helper
│   ├── drizzle/migrations/      ← Generated SQL migrations
│   ├── drizzle.config.ts
│   └── proxy.ts                 ← Edge middleware (route guard)
│
├── .claude/
│   ├── agents/                  ← AI subagent definitions
│   ├── commands/                ← Athena slash commands
│   ├── skills/                  ← Auto-loaded context injectors
│   └── settings.json            ← Hooks config
│
└── scripts/                     ← Build, epic graph, hooks
```

---

## Auth Flow

```
1. User visits /dashboard/*
2. proxy.ts (edge) → auth() → no session → redirect /login
3. User submits login form
4. Auth.js handler (app/api/auth/[...nextauth]/route.ts) validates credentials
   (Credentials provider: bcrypt compare via lib/password.ts)
5. JWT session minted (role snapshotted into the token); httpOnly cookie set
6. Edge middleware allows the request through
7. Server Component calls auth() → gets session → queries DB as that user
8. RBAC guards (lib/permissions.ts) re-read the live role from the DB
```

---

## Request Lifecycle

```
Browser Request
  → proxy.ts (edge: auth guard, redirects)
  → Next.js router matches segment
  → layout.tsx (Server Component: session, nav data)
  → page.tsx (Server Component: page-specific data via Drizzle)
  → Client Components hydrated in browser

Mutation
  → Client form / button triggers Server Action
  → Server Action: auth() → validate → Drizzle write → revalidatePath()
  → Next.js re-renders affected segments
```
