---
name: openapi-first
description: >
  Spec-driven (SDD) workflow for this project. Use this skill whenever starting a new
  feature, adding a Route Handler or Server Action, changing a request/response shape, or
  discussing the API contract and type strategy. The TypeScript type contract is the single
  source of truth — code follows the agreed shape, never the reverse. Also use when someone
  asks about the API contract or spec-driven development process.
---

# Spec-First (SDD) — AI-Coding-Template (Next.js 16)

The project uses **Next.js Route Handlers** (for external-facing API endpoints) and
**Server Actions** (for form/mutation flows). There is no separate OpenAPI YAML in active
use — types are defined in TypeScript and shared between the Route Handler and any client
Component that calls it.

**Principle: agree on the type shape FIRST, then implement. Never write a Route Handler
or Server Action before the input/output types are defined and exported.**

## Workflow (NEVER SKIP steps)

1. **Define types** in `next-app/lib/types/` (or co-locate with the feature) — `Input`, `Result`, `ErrorShape`
2. **Write the failing test** (RED) — Vitest unit test for the logic, Playwright e2e for the flow
3. **Implement the Route Handler** (`next-app/app/api/<domain>/route.ts`) or **Server Action** (`"use server"`) — response shape must match the declared types exactly
4. **Consume in the Client Component** — import the shared types; no manual type duplication

## Route Handler Conventions

```typescript
// next-app/app/api/resource/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import type { ResourceRead, ResourceCreate } from "@/lib/types/resource";

export async function GET(req: NextRequest): Promise<NextResponse<ResourceRead[]>> { ... }
export async function POST(req: NextRequest): Promise<NextResponse<ResourceRead>> { ... }
```

- One file per domain resource: `app/api/<domain>/route.ts`
- Auth guard: `const session = await auth(); if (!session) return NextResponse.json({}, {status: 401})`
- Public endpoints: skip the session guard

## Server Action Conventions

```typescript
// next-app/app/(dashboard)/actions.ts
"use server";
import { auth } from "@/auth";
import type { ActionResult } from "@/lib/types/actions";

export async function updateResource(formData: FormData): Promise<ActionResult> { ... }
```

## Type Naming Conventions

PascalCase, domain-prefixed for clarity:

```typescript
export type UserRead = { id: string; email: string; role: string };
export type UserCreate = { email: string; password: string };
export type UserUpdate = Partial<Pick<UserCreate, "email">>;
export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };
```

## New Endpoint Checklist

- [ ] Types defined and exported from `next-app/lib/types/` before any implementation
- [ ] Test written (RED first — must fail before implementation)
- [ ] Route Handler or Server Action return type annotation matches defined types
- [ ] Auth guard present on protected endpoints
- [ ] `pnpm typecheck` passes after implementation
- [ ] Tests green: `pnpm test` + `pnpm test:e2e`

## Common Mistakes

- Adding a Route Handler without defining the response type first → drift between handler and consumer
- Defining types inline in the route file instead of exporting from `lib/types/` → no sharing
- Forgetting the auth guard on a protected route → data exposure
- Calling a Server Action from a Server Component when the data is needed at render time → use `async` Server Component with direct DB call instead
