# Next.js App Router — Best Practices

> Practices specific to this project's stack: **Next.js 16 + React 19 + Drizzle + shadcn/ui + Tailwind CSS v4**

---

## Component Placement

| Type | Where | When |
|---|---|---|
| Server Component | `app/` or `components/` | Default — fetches data, no interactivity |
| Client Component | `components/` with `"use client"` | Needs state, effects, or event handlers |
| shadcn/ui primitive | `components/ui/` | Generated via `npx shadcn@latest add` — never hand-edit |
| Page layout | `app/(group)/layout.tsx` | Persistent chrome (sidebar, nav) |
| Server Action | `actions/*.ts` | Data mutations; must start with `"use server"` |

**Never** put `"use client"` on a file that only passes data down. Move the directive to the smallest interactive leaf.

---

## `cn()` for All Class Names

```tsx
// ✅ correct
import { cn } from "@/lib/utils"
<div className={cn("flex items-center", isActive && "bg-accent")} />

// ❌ wrong — breaks when classes conflict
<div className={`flex items-center ${isActive ? "bg-accent" : ""}`} />
```

---

## Drizzle Query Patterns

```ts
// ✅ select specific columns — never select *
const users = await db
  .select({ id: usersTable.id, name: usersTable.name })
  .from(usersTable)

// ✅ always scope queries to the authenticated user
const items = await db
  .select()
  .from(itemsTable)
  .where(eq(itemsTable.userId, session.user.id))

// ✅ transactions for multi-step mutations
await db.transaction(async (tx) => {
  const [user] = await tx.insert(usersTable).values(userData).returning()
  await tx.insert(profilesTable).values({ userId: user.id })
})
```

---

## Authentication Rules

- **Always call `await auth()`** at the top of a Server Component or Server Action that needs the user.
- **Never trust client-side session** for authorization decisions — re-validate on the server.
- **Route protection via Middleware** (`middleware.ts`) handles redirects before the page renders.
- Sessions are validated at the edge; no DB hit for route guards.

```ts
// ✅ server action authorization
export async function deleteItem(id: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  // confirm ownership before delete
  const [item] = await db.select().from(itemsTable).where(
    and(eq(itemsTable.id, id), eq(itemsTable.userId, session.user.id))
  )
  if (!item) throw new Error("Not found")

  await db.delete(itemsTable).where(eq(itemsTable.id, id))
  revalidatePath("/dashboard/items")
}
```

---

## Error Handling

- Use `error.tsx` files in route segments to scope error boundaries.
- Server Actions that throw are caught by `useActionState` — return typed error state instead of throwing for user-facing validation errors.
- Never expose stack traces to the client.

```ts
// ✅ return typed error for user-facing validation
export async function createItem(prevState: State, formData: FormData): Promise<State> {
  const title = formData.get("title")
  if (!title || typeof title !== "string") {
    return { error: "Title is required" }
  }
  // ...
  return { success: true }
}
```

---

## Theme System

- Theme switching uses `next-themes` with the `class` strategy (adds `dark` to `<html>`).
- Use Tailwind `dark:` variants for dark mode — never inline `style=` color overrides.
- The keyboard shortcut `d` toggles dark/light — wired in `components/theme-provider.tsx`.

```tsx
// ✅ theme-aware styling
<div className="bg-white text-black dark:bg-zinc-900 dark:text-white" />

// ❌ bypasses theme system
<div style={{ backgroundColor: "#fff" }} />
```

---

## shadcn/ui Component Rules

- Add components with `npx shadcn@latest add <name>` — files land in `components/ui/`.
- **Never hand-edit `components/ui/`** — re-running the add command overwrites changes.
- Compose pages from `components/ui/` primitives; do not create page-level CSS files.
- Extend via the `className` prop and `cn()` — not by forking the primitive.

---

## Server Action + Form Pattern

```tsx
// ✅ use useActionState for Server Action forms (React 19)
"use client"
import { useActionState } from "react"
import { createItem } from "@/actions/items"

export function CreateItemForm() {
  const [state, formAction, isPending] = useActionState(createItem, null)
  return (
    <form action={formAction}>
      <input name="title" required />
      {state?.error && <p className="text-destructive">{state.error}</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Create"}
      </button>
    </form>
  )
}
```

---

## Performance

- **Loading states**: use `loading.tsx` (automatic Suspense) or explicit `<Suspense>` wrapping.
- **Optimistic updates**: use `useOptimistic` for immediate UI feedback before server confirms.
- **Parallel data fetching**: `Promise.all()` in Server Components — avoid sequential `await` chains.

```ts
// ✅ parallel fetches
const [user, items, stats] = await Promise.all([
  getUser(session.user.id),
  getItems(session.user.id),
  getStats(session.user.id),
])
```
