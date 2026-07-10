---
name: spec-first
description: >
  Spec-driven (SDD) workflow for this project. Use this skill whenever starting a new
  feature, adding a Route Handler or Server Action, changing a request/response shape, or
  discussing the data contract and type strategy. The Drizzle schema + Zod validation are
  the single source of truth — code follows the agreed shape, never the reverse. Also use
  when someone asks about the data contract or spec-driven development process, or when
  running /athena:spec.
---

# Spec-First (SDD) — AI-Coding-Template (Next.js 16)

The project uses **Next.js Route Handlers** (for external-facing API endpoints) and
**Server Actions** (for form/mutation flows). There is no separate OpenAPI YAML in active
use — the contract lives in two co-located TypeScript layers:

1. **Drizzle schema** — `next-app/lib/schema/<domain>.ts` (e.g. `lib/schema/items.ts`) —
   the DB-level shape (`pgTable`, generated `$inferSelect` row type).
2. **Zod validation** — `next-app/lib/validations/<domain>.ts` (e.g.
   `lib/validations/items.ts`) — the input-level shape (`createXSchema`, `updateXSchema`,
   and their `z.infer` types), shared between the Server Action/Route Handler and any
   client Component that calls it.

Domain business logic that isn't pure schema/validation (e.g. a title-validation helper,
a CSV export formatter) lives in a co-located `lib/<domain>-utils.ts` — see
`lib/items-utils.ts`, `lib/export-utils.ts`, `lib/team-utils.ts` for the pattern.

**Principle: agree on the schema + Zod shape FIRST, then implement. Never write a Route
Handler or Server Action before the Drizzle table and Zod schema are defined and exported.**

This is exactly what `/athena:spec` (→ `@spec-writer`) outputs to `docs/epics/`: **Drizzle
schema + Zod validation + action/route signatures + RBAC** — one artifact per feature, before
any implementation starts.

## Workflow (NEVER SKIP steps)

1. **Define the Drizzle table** in `next-app/lib/schema/<domain>.ts` — export the table and
   its `$inferSelect` row type; wire it into the `lib/schema/index.ts` barrel.
2. **Define the Zod schema(s)** in `next-app/lib/validations/<domain>.ts` — `createXSchema`,
   `updateXSchema`, and their inferred `Input` types.
3. **Write the failing test** (RED) — Vitest unit test for validation/pure logic, an
   integration test (`test/int/*.int.test.ts`) for the Server Action's DB + RBAC behavior,
   Playwright e2e for the full flow.
4. **Implement the Route Handler** (`next-app/app/api/<domain>/route.ts`) or **Server
   Action** (`"use server"`, typically in `next-app/actions/<domain>.ts`) — response shape
   must match the Zod/Drizzle types exactly, and mutating actions must carry an RBAC guard
   (`requireAuth`/`requireEditor`/`canEdit` from `@/lib/permissions`, or `defineAction()`
   from `@/lib/define-action` — see E323).
5. **Consume in the Client Component** — import the shared Zod-inferred types; no manual
   type duplication.

## Route Handler Conventions

```typescript
// next-app/app/api/resource/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createResourceSchema } from "@/lib/validations/resource";
import type { Resource } from "@/lib/schema";

export async function GET(req: NextRequest): Promise<NextResponse<Resource[]>> { ... }
export async function POST(req: NextRequest): Promise<NextResponse<Resource>> { ... }
```

- One file per domain resource: `app/api/<domain>/route.ts`
- Auth guard: `const session = await auth(); if (!session) return NextResponse.json({}, {status: 401})`
- Public endpoints: skip the session guard

## Server Action Conventions

```typescript
// next-app/actions/resource.ts
"use server";
import { db } from "@/lib/db";
import { requireEditor } from "@/lib/permissions";
import { updateResourceSchema } from "@/lib/validations/resource";

type State = { error?: string } | null;

export async function updateResource(prevState: State, formData: FormData): Promise<State> {
  const session = await requireEditor(); // RBAC guard — never skip on a mutating action
  const validated = updateResourceSchema.safeParse({ title: formData.get("title") });
  if (!validated.success) return { error: validated.error.issues[0].message };
  // ... db.update(...)
  return null; // success — no redirect; the modal closes + list revalidates (E273)
}
```

Prefer the `defineAction()` factory (`@/lib/define-action`, E323) for new mutating actions —
it composes guard → validate → authorize → handler → audit → revalidate for you; see
`next-app/actions/items.ts` (`deleteItemAction`) for the reference migration.

## Naming Conventions

Schema types are PascalCase, domain-named; Zod input types are `<Verb><Domain>Input`:

```typescript
// lib/schema/items.ts
export type Item = typeof itemsTable.$inferSelect;

// lib/validations/items.ts
export const createItemSchema = z.object({ title: z.string().min(1).max(255) });
export type CreateItemInput = z.infer<typeof createItemSchema>;
```

## New Endpoint Checklist

- [ ] Drizzle table defined in `lib/schema/<domain>.ts`, wired into `lib/schema/index.ts`
- [ ] Zod schema(s) defined and exported from `lib/validations/<domain>.ts` before any implementation
- [ ] Test written (RED first — must fail before implementation)
- [ ] Route Handler or Server Action return type annotation matches the Drizzle/Zod types
- [ ] RBAC guard present on protected/mutating endpoints
- [ ] `pnpm typecheck` passes after implementation
- [ ] Tests green: `pnpm test` (+ `pnpm test:int` if a Server Action changed) + `pnpm test:e2e`

## Common Mistakes

- Adding a Route Handler without defining the Zod response/request shape first → drift between handler and consumer
- Defining validation inline in the route/action file instead of exporting from `lib/validations/` → no sharing, no reuse in tests
- Forgetting the RBAC guard on a mutating Server Action → data exposure (Stop-verifier Rule 2 blocks this)
- Calling a Server Action from a Server Component when the data is needed at render time → use `async` Server Component with direct DB call instead
