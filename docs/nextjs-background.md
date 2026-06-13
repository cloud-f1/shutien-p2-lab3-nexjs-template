# Next.js App Router — Background & Key Concepts

> This project uses **Next.js 16 (App Router) + React 19**. These versions have breaking changes from older Next.js training data. Always read from `node_modules/next/dist/docs/` before assuming behavior.

---

## Why App Router (not Pages Router)

| | Pages Router | App Router |
|---|---|---|
| Default component type | Client Component | **Server Component** |
| Data fetching | `getServerSideProps` / `getStaticProps` | `async` directly in components |
| Mutations | API routes only | **Server Actions** (`"use server"`) |
| Layouts | Manual wiring | File-system `layout.tsx` nesting |
| Streaming | Manual | Built-in via React Suspense |
| Route groups | Not supported | `(group)/` folders |

App Router enables full-stack TypeScript — data fetching and mutations live alongside UI with no separate REST layer.

---

## File System Conventions

| File | Role |
|---|---|
| `layout.tsx` | Persistent wrapper; does not re-render on navigation |
| `page.tsx` | The route's leaf UI; receives `params` and `searchParams` |
| `loading.tsx` | Suspense fallback shown while the page streams |
| `error.tsx` | Error boundary for the route segment |
| `not-found.tsx` | Rendered when `notFound()` is called |
| `route.ts` | API endpoint (no UI) — replaces Pages Router `/api/` files |
| `middleware.ts` | Edge-runtime interceptor; runs before route resolves |

Route groups `(name)/` organize routes without adding a URL segment.

---

## Server Components vs Client Components

```
Server Component (default)       Client Component ("use client")
─────────────────────────        ──────────────────────────────
Can be async                     Must be sync (hooks are async-safe)
Fetch DB/API directly            Cannot access server-only modules
No bundle size impact            Adds to JS bundle
No useState / useEffect          Full React hooks available
No event handlers                onClick, onChange etc. work
```

**Rule:** keep components Server by default. Push `"use client"` to the smallest leaf that needs interactivity.

---

## React 19 Notes

React 19 ships several patterns this project leverages:

- **`useActionState`** — replaces `useFormState` from React-DOM. Wraps a Server Action and returns `[state, formAction, isPending]`.
- **`useOptimistic`** — optimistic UI updates before the server confirms.
- **Form `action` prop** — forms can take a Server Action directly as the `action` prop (no `onSubmit` needed for simple mutations).
- **`use()` hook** — unwraps a Promise or Context in render without `useEffect`.

---

## Data Fetching Patterns

```tsx
// ✅ Fetch in an async Server Component — no useEffect, no useState
export default async function DashboardPage() {
  const session = await auth()
  const items = await db.select().from(itemsTable).where(eq(itemsTable.userId, session.user.id))
  return <ItemList items={items} />
}

// ✅ Pass searchParams for server-side filtering
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const results = await db.select().from(itemsTable).where(like(itemsTable.title, `%${q ?? ""}%`))
  return <Results data={results} />
}
```

---

## Mutation Pattern (Server Actions)

```ts
// actions/items.ts
"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { itemsTable } from "@/lib/schema"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createItem(formData: FormData) {
  const session = await auth()
  if (!session) throw new Error("Unauthorized")

  await db.insert(itemsTable).values({
    title: formData.get("title") as string,
    userId: session.user.id,
  })

  revalidatePath("/dashboard")
  redirect("/dashboard")
}
```

`revalidatePath` clears the route's cached data so the next navigation sees fresh content.

---

## Streaming & Suspense

Wrap slow data with `<Suspense>` to stream content:

```tsx
import { Suspense } from "react"

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <SlowDataComponent />
    </Suspense>
  )
}
```

Or drop `loading.tsx` next to `page.tsx` — Next.js wraps the page automatically.

---

## URL as State

Filter, sort, and pagination values belong in the URL query string — not in `useState`. This makes state bookmarkable and accessible on the server.

```tsx
// Server Component reads searchParams
export default async function ItemsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page = "1" } = await searchParams
  const items = await db.select().from(itemsTable).limit(20).offset((+page - 1) * 20)
  ...
}
```
