# Client Layer — Next.js App Router Tech Stack

> There is no separate SPA. The "client" is the browser-facing half of the same
> Next.js app: `app/` routes rendered as Server Components by default, with
> `"use client"` islands only where the browser needs them.

## Packages

| Layer | Package | Purpose |
|---|---|---|
| Framework | `next` (16, App Router) | Routing, RSC streaming, layouts |
| Language | `TypeScript` 5.x | Shared types with the server half (no codegen) |
| UI runtime | `React` 19 | Server Components + Client Components |
| Components | `shadcn/ui` | Generated into `components/ui/` via the CLI |
| Styling | `Tailwind CSS` v4 | `dark:` variants, `globals.css` directives |
| Theme | `next-themes` | Class-strategy dark mode (`components/theme-provider.tsx`) |
| Forms | `react-hook-form` + `zod` | Schema-validated forms (shared `lib/validations/*`) |
| Tables | `@tanstack/react-table` | Powers the reusable `<DataTable>` |
| Class merge | `clsx` + `tailwind-merge` | `cn()` helper in `lib/utils.ts` |
| Testing | `vitest` | Unit tests |
| E2E | `@playwright/test` | Browser flows |

> No Vite, no Axios, no Zustand, no React Query, no MSW, no react-router. Data
> comes from Server Components / Server Actions, so there's no client-side HTTP
> cache layer to manage and no network mocking library.

## RSC vs Client Boundary

- **Default to Server Components.** Pages and layouts are `async` server functions
  that fetch from Drizzle and render HTML on the server.
- Add `"use client"` **only** when you need browser APIs, event handlers, or React
  state/hooks. Keep client components small and pushed to the leaves.
- Data flows **down** as props (server → client). Mutations flow **up** by calling
  a Server Action directly from a client form/button — no fetch client, no
  interceptors.

```tsx
// Server Component (default) — fetches and renders on the server
export default async function ItemsPage() {
  const items = await getItems()            // Drizzle, runs on server
  return <ItemsTable items={items} />       // passes data to a client island
}
```

## App Router Structure

Route groups isolate layouts without affecting the URL:

```
app/
  layout.tsx              Root layout: fonts + ThemeProvider
  page.tsx                Homepage
  globals.css             Tailwind v4 directives + theme tokens
  (auth)/                 Public auth area (own layout.tsx)
    login/
    register/
    verify-email/
  (dashboard)/            Protected area (own layout.tsx, error.tsx, loading.tsx)
    dashboard/
      items/              CRUD reference: modal create/edit + <DataTable>
  api/                    Route Handlers (auth, health, billing webhooks)
  invite/                 Invitation accept flow
```

## Auth on the Client

The session is managed by Auth.js (JWT cookie), not a client token store.

- **Route guarding** happens at the edge in `proxy.ts` — unauthenticated requests
  to protected routes are redirected before the page renders.
- **Server-side reads** call `auth()` (from `lib/auth.ts`) inside Server Components
  to get the session and the user's role.
- **Client-side conditional UI** uses the client-safe `isAdmin(role)` / `canEdit(role)`
  helpers from `lib/is-admin.ts` (pure booleans, no server imports). Never trust
  these for security — they only hide/show UI; the Server Action re-checks the role.

### Login Flow

```
1. User submits email + password on /login (Client Component form)
2. signIn("credentials", ...) (Auth.js) posts to app/api/auth/[...nextauth]
3. authorize() looks up the user, compares bcrypt hash, snapshots role into JWT
4. Auth.js sets the httpOnly session cookie
5. proxy.ts now allows the request through to /dashboard
6. Dashboard Server Components call auth() -> get session -> query DB as that user
```

> **NEVER** store the session in `localStorage`. Auth.js keeps it in an `httpOnly`
> cookie, unreadable by JavaScript — the XSS protection is structural.

## Forms & Mutations

Forms use `react-hook-form` with a `zod` resolver against the **same** schema the
Server Action validates with (`lib/validations/*`), so client and server agree by
construction. On submit, the handler calls the Server Action directly:

```tsx
"use client"
async function onSubmit(values: ItemInput) {
  const res = await createItem(values)        // Server Action
  if (res.error) { /* show inline error */ }
  else { onSuccess(); router.refresh() }       // close modal, refresh list
}
```

### CRUD convention (E273)

- Create/edit open a shadcn `Dialog` (a form with an `onSuccess` callback); delete
  uses `components/confirm-dialog.tsx`.
- The Server Action **returns success (no `redirect`)** so the modal closes and the
  list refreshes via `revalidatePath` + `router.refresh()`.
- Deep-link a modal open with a query param (`?new=1`, `?edit=<id>`).
- Reference implementation: `app/(dashboard)/dashboard/items/`.

### List/table views

Record lists use the reusable `<DataTable>` (`components/data-table-generic.tsx`,
built on `@tanstack/react-table`) with built-in filter + pagination + page-size —
never a hand-rolled `<table>`.

## Theming (Tailwind v4 + next-themes)

- `next-themes` class strategy toggles `dark` on `<html>`; the toggle lives in
  `components/theme-provider.tsx` (keyboard `d` toggles dark).
- Color is expressed only through Tailwind `dark:` variants and theme tokens in
  `globals.css`. **No inline `style=` color overrides** (a Stop hook blocks them).
- All conditional classes go through `cn()` (`lib/utils.ts`) — never raw string
  concatenation.

## shadcn/ui

- Components are generated into `components/ui/` via `npx shadcn@latest add <name>`
  (run from `next-app/`). **Never hand-author files there** — a Stop hook enforces
  this. The blue preset is applied repo-wide.

## Testing

```bash
cd next-app
pnpm test            # vitest run (unit)
pnpm test:coverage   # v8 coverage (80% gate)
pnpm test:e2e        # playwright, chromium project
```

Component/logic units are tested with Vitest; full UI flows
(`e2e/auth-flow.spec.ts`, `e2e/items-crud.spec.ts`, `e2e/dashboard-smoke.spec.ts`)
run under Playwright against a seeded DB. There is no MSW network mocking — e2e
talks to a real seeded database.
