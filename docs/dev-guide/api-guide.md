# API Guide

> Architecture reference: [../techstack/architecture.md](../techstack/architecture.md).
> This is a single Next.js 16 app under `next-app/` — there is **no separate API server** and
> **no OpenAPI spec**. The "API surface" is a mix of Server Actions, Route Handlers, and
> Server-Component data fetching, all in-process.

## The Three API Surfaces

| Surface | Where | Use for | Callable cross-origin? |
|---|---|---|---|
| **Server Component fetch** | `app/**/page.tsx` (async) | reading data to render a page | No (server-only) |
| **Server Action** (`"use server"`) | `actions/*.ts` | mutations from forms/components | No (same-origin RPC) |
| **Route Handler** | `app/api/**/route.ts` | webhooks, health, OAuth, public HTTP | Yes (real HTTP endpoint) |

Pick a **Server Action** for app-internal mutations (create/edit/delete) invoked from your own
React UI. Pick a **Route Handler** only when something *outside* the app must reach an HTTP URL —
a payment provider webhook, a health probe, the NextAuth callback.

## Adding a Server Action

A Server Action is an async function with the `"use server"` directive. It runs on the server,
is invoked directly from a component or form, and **cannot be called cross-origin**. Guard it,
validate input, mutate via Drizzle, then `revalidatePath` so the UI refreshes.

Real example — `next-app/actions/items.ts`:

```ts
"use server"

import { db } from "@/lib/db"
import { itemsTable } from "@/lib/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireEditor } from "@/lib/permissions"

type State = { error?: string } | null

export async function createItem(prevState: State, formData: FormData): Promise<State> {
  // 1. Guard — viewers are read-only; requireEditor() redirects them away.
  const session = await requireEditor()

  // 2. Validate input
  const title = formData.get("title")
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return { error: "請輸入標題" }
  }

  // 3. Mutate (ownership-scoped via session.user.id)
  await db.insert(itemsTable).values({ title: title.trim(), userId: session.user.id })

  // 4. Revalidate — the modal closes + the list refreshes
  revalidatePath("/dashboard/items")
  return null // success
}
```

Mutations are **ownership-scoped**: the `WHERE` clause always includes `userId`, so a user can
only touch their own rows (see `deleteItem` / `updateItem` in the same file).

## RBAC Guard Pattern

Guards live in `next-app/lib/permissions.ts`. Each one resolves the session and **re-reads the
role from the database** (not from the JWT snapshot) so a demotion takes effect immediately:

| Guard | Allows | Redirects |
|---|---|---|
| `requireAuth()` | any signed-in user | `/login` |
| `requireEditor()` | `admin`, `editor` | `/dashboard` (viewers) |
| `requireAdmin()` | `admin` | `/dashboard` (everyone else) |

```ts
import { requireAdmin } from "@/lib/permissions"

export async function setUserRole(userId: string, role: Role) {
  "use server"
  const session = await requireAdmin() // re-reads role from DB; redirects non-admins
  // ...admin logic
}
```

Because Server Actions compile to **public POST endpoints**, never trust the TypeScript type of an
argument at runtime — validate it. `actions/admin.ts` keeps a `VALID_ROLES` allowlist for exactly
this reason.

## Shared Validation (Zod)

Validation schemas are shared from `next-app/lib/validations/*` so the same rules apply on the
client (react-hook-form resolver) and the server (action). Example — `lib/validations/items.ts`:

```ts
import { z } from "zod"

export const createItemSchema = z.object({
  title: z.string().min(1, "請輸入標題").max(255, "標題過長"),
})

export type CreateItemInput = z.infer<typeof createItemSchema>
```

Auth and user schemas live in `lib/validations/auth.ts` and `lib/validations/user.ts`.

## Adding a Route Handler

Route Handlers are real HTTP endpoints — use them for webhooks, health checks, and OAuth
callbacks. They live at `app/api/**/route.ts` and export functions named for HTTP verbs.

Health check — `next-app/app/api/health/route.ts`:

```ts
export async function GET() {
  return Response.json({ status: "ok", timestamp: new Date().toISOString() })
}
```

A webhook handler reads the raw body, verifies a signature, and processes idempotently —
see `next-app/app/api/billing/stripe/webhook/route.ts` for the full pattern (raw `request.text()`
for signature verification, a `payment_events` unique constraint for idempotency, and
`export const dynamic = "force-dynamic"` to disable body buffering).

## Current Route Handler Surface

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Service health probe |
| `GET`/`POST` | `/api/auth/[...nextauth]` | NextAuth.js v5 (session, sign-in/out, OAuth callback) |
| `POST` | `/api/billing/stripe/webhook` | Stripe webhook (signature-verified, idempotent) |
| `POST` | `/api/billing/ecpay/return` | ECPay 綠界 first-auth notification |
| `POST` | `/api/billing/ecpay/period` | ECPay 綠界 recurring-cycle notification |

## Auth

Auth.js (NextAuth) v5 with the **Credentials** provider + **Google** OAuth, configured in
`next-app/lib/auth.ts`. Sessions use the **JWT strategy** (required — the Credentials provider
cannot create DrizzleAdapter database sessions). The `proxy.ts` edge middleware protects routes,
and RBAC guards re-read the role from the DB on every check. See the `nextjs-saas-patterns` skill
for the auth gotchas that have already bitten people here.

## Code Examples

See [../techstack/architecture.md](../techstack/architecture.md) for the system diagram and
data-flow patterns.
