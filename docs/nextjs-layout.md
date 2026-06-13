# Next.js App Router — Layout & Architecture Guide

> Reference architecture for building a full-stack Next.js app with authentication, CRUD operations, and a dashboard using **App Router + Auth.js v5 + Drizzle + Tailwind CSS v4 + shadcn/ui**.

---

## Recommended Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js App Router | RSC + Server Actions = full-stack TypeScript |
| Auth | Auth.js v5 (NextAuth) | Native RSC support, edge middleware |
| ORM | Drizzle + postgres | Type-safe, lightweight, SQL-first |
| DB | PostgreSQL | Robust relational DB |
| UI | shadcn/ui + Tailwind CSS v4 | Accessible, composable primitives |

---

## Folder Structure

Route groups isolate layout concerns — `(auth)` and `(dashboard)` share nothing.

```
next-app/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx          # Login page
│   │   ├── register/
│   │   │   └── page.tsx          # Register page
│   │   └── layout.tsx            # Centered form layout
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   │   ├── items/
│   │   │   │   ├── page.tsx      # Item list
│   │   │   │   ├── create/
│   │   │   │   │   └── page.tsx  # Create form
│   │   │   │   └── [id]/
│   │   │   │       └── edit/
│   │   │   │           └── page.tsx
│   │   │   └── page.tsx          # Dashboard overview
│   │   └── layout.tsx            # Sidebar + navbar layout
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts      # Auth.js REST endpoints
│   ├── layout.tsx                # Root layout (fonts, ThemeProvider)
│   ├── page.tsx                  # Landing page
│   └── globals.css
├── actions/
│   └── items.ts                  # Server Actions for mutations
├── components/
│   ├── ui/                       # shadcn/ui components (generated)
│   ├── sidebar.tsx               # Dashboard nav
│   ├── delete-button.tsx         # Client component for delete
│   └── theme-provider.tsx
├── lib/
│   ├── auth.ts                   # Auth.js config + session helper
│   ├── db.ts                     # Drizzle client singleton
│   ├── schema.ts                 # Drizzle table definitions
│   └── utils.ts                  # cn() helper
├── drizzle/
│   └── migrations/               # Generated migration files
├── drizzle.config.ts
└── middleware.ts                 # Edge route guard
```

---

## Step 1 — Middleware Route Guard

Runs at the edge before any page renders. Redirects unauthenticated users away from dashboard routes.

```ts
// proxy.ts  (Next.js 16 renamed middleware.ts → proxy.ts)
import { auth } from "@/lib/auth"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isDashboard = req.nextUrl.pathname.startsWith("/dashboard")

  if (isDashboard && !isLoggedIn) {
    return Response.redirect(new URL("/login", req.nextUrl))
  }
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
```

---

## Step 2 — Server Actions for Mutations

Server Actions replace API route handlers for mutations. They run on the server, are type-safe, and integrate with React forms.

```ts
// actions/items.ts
"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { itemsTable } from "@/lib/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createItem(prevState: unknown, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const title = formData.get("title") as string
  if (!title) return { error: "Title is required" }

  await db.insert(itemsTable).values({ title, userId: session.user.id })

  revalidatePath("/dashboard/items")
  redirect("/dashboard/items")
}

export async function deleteItem(id: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  await db
    .delete(itemsTable)
    .where(and(eq(itemsTable.id, id), eq(itemsTable.userId, session.user.id)))

  revalidatePath("/dashboard/items")
}
```

---

## Step 3 — Data Fetching in Server Components

Fetch directly inside `async` Server Components — no `useEffect`, no API routes for reads.

```tsx
// app/(dashboard)/dashboard/items/page.tsx
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { itemsTable } from "@/lib/schema"
import { eq } from "drizzle-orm"
import Link from "next/link"
import { DeleteButton } from "@/components/delete-button"

export default async function ItemsPage() {
  const session = await auth()
  const items = await db
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.userId, session!.user!.id))
    .orderBy(itemsTable.createdAt)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Items</h1>
        <Link href="/dashboard/items/create" className="btn-primary">
          + New Item
        </Link>
      </div>
      <ul className="divide-y rounded-lg border">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between p-4">
            <span>{item.title}</span>
            <div className="flex gap-2">
              <Link href={`/dashboard/items/${item.id}/edit`}>Edit</Link>
              <DeleteButton id={item.id} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

---

## Architecture Optimization Notes

| Pattern | Implementation |
|---|---|
| Loading states | `loading.tsx` next to `page.tsx` — automatic Suspense boundary |
| Optimistic UI | `useOptimistic` hook in Client Components |
| URL as state | Pass `searchParams` to Server Components for filters and pagination |
| Parallel fetches | `Promise.all([...])` in Server Components |
| Error boundaries | `error.tsx` per route segment |
