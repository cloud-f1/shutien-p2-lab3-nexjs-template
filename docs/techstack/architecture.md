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
│  │ Server Actions │    │ Route Handlers (api/)           │   │
│  │ actions/*.ts  │    │ app/api/auth/[...nextauth]/      │   │
│  └───────┬───────┘    └───────────────┬─────────────────┘   │
│          │                            │                       │
│          └──────────┬─────────────────┘                      │
│                     │ Drizzle ORM                            │
├─────────────────────┼──────────────────────────────────────-─┤
│                     ▼                                        │
│                PostgreSQL 15                                 │
│   Auth.js sessions · users · accounts · domain tables        │
└──────────────────────────────────────────────────────────────┘

Edge: middleware.ts → auth check → redirect / allow
```

**Design Principle:** Next.js is the full-stack boundary. Server Components and Server Actions talk directly to PostgreSQL via Drizzle. No separate API server; Auth.js handles authentication.

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
│   │   ├── auth.ts              ← Auth.js config + session helper
│   │   ├── db.ts                ← Drizzle client singleton
│   │   ├── schema.ts            ← Drizzle table definitions
│   │   └── utils.ts             ← cn() helper
│   ├── drizzle/migrations/      ← Generated SQL migrations
│   ├── drizzle.config.ts
│   └── middleware.ts            ← Edge route guard
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
2. middleware.ts (edge) → auth() → no session → redirect /login
3. User submits login form
4. Auth.js handler (app/api/auth/[...nextauth]/route.ts) validates credentials
5. Session created in DB (Auth.js Drizzle adapter)
6. Cookie set; middleware allows through
7. Server Component calls auth() → gets session → queries DB as that user
```

---

## Request Lifecycle

```
Browser Request
  → middleware.ts (edge: auth guard, redirects)
  → Next.js router matches segment
  → layout.tsx (Server Component: session, nav data)
  → page.tsx (Server Component: page-specific data via Drizzle)
  → Client Components hydrated in browser

Mutation
  → Client form / button triggers Server Action
  → Server Action: auth() → validate → Drizzle write → revalidatePath()
  → Next.js re-renders affected segments
```
