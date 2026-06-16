# API Guide

This is a single Next.js 16 app — there is **no separate API server and no OpenAPI spec**. The
"API surface" is three things: Server-Component data fetching, Server Actions, and Route Handlers.

| Surface | Where | Use for | Cross-origin? |
|---|---|---|---|
| Server Component fetch | `app/**/page.tsx` (async) | reading data to render a page | No |
| Server Action (`"use server"`) | `actions/*.ts` | mutations from forms/components | No |
| Route Handler | `app/api/**/route.ts` | webhooks, health, OAuth | Yes |

## Route Handlers

Route Handlers live in `next-app/app/api/` and follow the App Router `route.ts` convention. Use
them only when something *outside* the app must reach an HTTP URL.

### Health Check

```
GET /api/health
```

Returns `{ status: "ok", timestamp: "..." }` from `app/api/health/route.ts`. Use this to verify
the deployed app is reachable and the interactive API playground is pointed at the right base URL.

### Current Route Handler Surface

```
GET|POST /api/auth/[...nextauth]      → Auth.js v5 (session, sign-in/out, OAuth callback)
GET      /api/health                  → health probe
POST     /api/billing/stripe/webhook  → Stripe webhook (signature-verified, idempotent)
POST     /api/billing/ecpay/return    → ECPay 綠界 first-auth notification
POST     /api/billing/ecpay/period    → ECPay 綠界 recurring-cycle notification
```

### Auth Session (Auth.js v5)

Auth.js v5 uses the **JWT strategy** — sessions are stateless. The session object is:

```ts
type Session = {
  user: {
    id: string
    email: string
    name: string | null
    role: 'viewer' | 'editor' | 'admin'
  }
  expires: string
}
```

Read it server-side with `auth()` from `@/lib/auth`. The Credentials provider requires JWT
sessions (it cannot create DrizzleAdapter database sessions).

## Server Actions

Server Actions (`"use server"`) run on the server and are invoked directly from React components
or forms. They compile to same-origin POST endpoints — they **cannot** be called cross-origin.

### Items (`actions/items.ts`)

```ts
createItem(prevState, formData): Promise<{ error?: string } | null>
updateItem(id, prevState, formData): Promise<{ error?: string } | null>
deleteItem(id): Promise<{ error?: string } | null>
```

Each mutation calls `requireEditor()`, validates input, and scopes the Drizzle `WHERE` clause by
`userId`. Returning `null` signals success (the modal closes, the list revalidates).

### Account (`actions/user.ts`)

Profile update, password change, account deletion — each derives the user ID from the session,
never the request body, so a user can only act on their own account.

### Admin (`actions/admin.ts`)

> Requires the `admin` role — `requireAdmin()` redirects everyone else.

```ts
getAllUsers(): Promise<User[]>
setUserRole(userId, role): Promise<{ success: true } | { error: string }>
deleteUser(userId): Promise<{ success: true } | { error: string }>
```

`setUserRole` keeps a runtime `VALID_ROLES` allowlist and refuses self-demotion / self-deletion.

## RBAC Guard Pattern

Guards live in `@/lib/permissions`. Each resolves the session and **re-reads the role from the
database** (not the JWT snapshot), so a demotion takes effect immediately.

| Guard | Allows | Redirects |
|---|---|---|
| `requireAuth()` | any signed-in user | `/login` |
| `requireEditor()` | `admin`, `editor` | `/dashboard` |
| `requireAdmin()` | `admin` | `/dashboard` |

```ts
import { requireAdmin } from '@/lib/permissions'

export async function adminAction() {
  'use server'
  const session = await requireAdmin() // re-reads role from DB; redirects non-admins
  // ...admin logic
}
```

Server Actions are public POST endpoints — never trust an argument's TypeScript type at runtime.
Validate against a shared Zod schema (`lib/validations/*`) or a runtime allowlist.

## Validation Envelope

Item/account actions return a small state object — `{ error?: string } | null` (null = success).
Admin actions return `{ success: true } | { error: string }`. Validation schemas are shared from
`lib/validations/*` so the same Zod rules run on the client form and the server action.

## Interactive Playground

Test live Route Handlers against your deployed Next.js app:

<ApiPlayground
  defaultEndpoint="/api/health"
  defaultMethod="GET"
  liveAppPath="/"
/>
