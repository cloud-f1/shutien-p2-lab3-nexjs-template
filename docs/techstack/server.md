# Server Layer — Next.js Tech Stack

> There is no separate API server. The "server side" is the Next.js app itself
> (`next-app/`): Server Components fetch data, Server Actions mutate it, and
> Route Handlers expose the few endpoints that genuinely need an HTTP surface.

## Packages

| Layer | Package | Purpose |
|---|---|---|
| Framework | `next` (16, App Router) | Server Components + Server Actions + Route Handlers |
| Language | `TypeScript` 5.x | End-to-end types, no codegen step |
| Runtime | React 19 (RSC) | Server Components render on the server by default |
| Auth | `next-auth` v5 (Auth.js) | Credentials + Google, **JWT sessions** |
| Adapter | `@auth/drizzle-adapter` | Persists users/accounts in Postgres |
| Password | `bcryptjs` | Hash + compare in `lib/password.ts` |
| ORM | `drizzle-orm` + `postgres-js` | Typed schema + queries against Postgres |
| Migrations | `drizzle-kit` | `db:generate` (diff → SQL) / `db:migrate` (apply) |
| Validation | `zod` | Shared schemas in `lib/validations/*` |
| Testing | `vitest` | Unit tests (`lib/**/*.test.ts`) |
| E2E | `@playwright/test` | Browser flows (`e2e/*.spec.ts`) |

> No FastAPI, no SQLAlchemy/Alembic, no Pydantic, no PyJWT/bcrypt-the-python-lib,
> no pytest, no uvicorn. The whole server side runs inside the Next.js process.

## API Surface

The "API" is three cooperating mechanisms, not a REST controller layer:

1. **Server Components** (default) — `async` page/layout components fetch directly
   from Drizzle. No fetch round-trip, no JSON serialization at the boundary.
2. **Server Actions** (`actions/*.ts`, top-of-file `"use server"`) — the mutation
   surface. Forms and client buttons call them directly; they run on the server,
   validate with Zod, write via Drizzle, then `revalidatePath()`.
3. **Route Handlers** (`app/api/**/route.ts`) — only where a real HTTP endpoint is
   needed: Auth.js callbacks, health check, and billing webhooks.

### Server Actions (`actions/`)

| File | Covers |
|---|---|
| `actions/auth.ts` | register / login glue around Auth.js |
| `actions/user.ts` | account-settings profile + password updates |
| `actions/items.ts` | items CRUD (reference modal/DataTable pattern) |
| `actions/admin.ts` | admin user management (role changes, suspend) |
| `actions/team.ts` | team membership + invitations |
| `actions/api-keys.ts` | API key issue/revoke |
| `actions/webhooks.ts` | outbound webhook registration |
| `actions/notifications.ts` | in-app notifications |
| `actions/billing.ts` | checkout / subscription glue |

> CRUD actions **return success (no `redirect`)** so the calling modal can close
> and the list refreshes via `revalidatePath` + `router.refresh()` (E273).

### Route Handlers (`app/api/`)

| Method(s) | Path | Auth | Description |
|---|---|---|---|
| `GET`/`POST` | `app/api/auth/[...nextauth]/route.ts` | — | Auth.js sign-in / callback / session |
| `GET` | `app/api/health/route.ts` | — | Liveness probe for the platform |
| `POST` | `app/api/billing/stripe/webhook/route.ts` | signature | Stripe events |
| `POST` | `app/api/billing/ecpay/return/route.ts` | signature | ECPay first-auth notify |
| `POST` | `app/api/billing/ecpay/period/route.ts` | signature | ECPay per-cycle notify |

### Validation & Errors

There is no OpenAPI contract. The request shape is whatever the Server Action /
Route Handler accepts, validated with shared Zod schemas in `lib/validations/`
(`auth.ts`, `user.ts`, `items.ts`, `types.ts`). On a Zod failure an action returns
a structured `{ error }` object (or `fieldErrors`) that the form renders inline —
HTTP status codes only matter for the Route Handlers.

## Database Design

### Schema (Drizzle)

Tables live in `lib/schema/` as typed Drizzle definitions, re-exported through a
barrel `lib/schema/index.ts`:

| File | Tables |
|---|---|
| `lib/schema/auth.ts` | `users`, `accounts`, `sessions`, `verification_tokens` (Auth.js) + `role`/`member_status` enums |
| `lib/schema/items.ts` | `items` (the CRUD reference domain) |
| `lib/schema/billing.ts` | subscriptions / billing records |
| `lib/schema/system.ts` | invitations, API keys, webhooks, notifications, audit |

### Core Tables

```
users
  id              UUID  PK  defaultRandom()
  name            TEXT  NULLABLE
  email           TEXT  UNIQUE NOT NULL
  email_verified  TIMESTAMP NULLABLE
  image           TEXT  NULLABLE
  password_hash   TEXT  NULLABLE          <- NULL = OAuth-only account
  role            role ENUM NOT NULL DEFAULT 'viewer'   <- admin | editor | viewer
  status          member_status ENUM NOT NULL DEFAULT 'active'
  created_at      TIMESTAMP NOT NULL DEFAULT now()
  updated_at      TIMESTAMP NOT NULL DEFAULT now()

accounts   (Auth.js) — OAuth provider links, FK -> users.id (cascade)
sessions   (Auth.js) — present for the Drizzle adapter; sessions are JWT, not DB-read
verification_tokens (Auth.js) — email verification / magic links
```

### Drizzle Pattern

```ts
// lib/schema/auth.ts
export const roleEnum = pgEnum("role", ["admin", "editor", "viewer"])

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),        // null for OAuth-only users
  role: roleEnum("role").notNull().default("viewer"),
  // ...
})
```

### Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Primary Key | UUID `defaultRandom()` | Prevents sequential enumeration |
| Session strategy | **JWT** (not DB sessions) | Auth.js Credentials requires it; adapter tables stay for OAuth links |
| RBAC source of truth | re-read role from DB | Demotions take effect immediately, not on next sign-in |
| Migrations | plain `.sql` in `drizzle/migrations/` | Generated by `drizzle-kit generate`, applied by `drizzle-kit migrate` |
| Password hashing | `bcryptjs` | Pure-JS, no native build step in the Node runtime |

## Security Architecture

| Threat | Defense |
|---|---|
| Session theft via XSS | Auth.js session cookie is `httpOnly`; no token in JS-readable storage |
| Stale privileges after demotion | `lib/permissions.ts` re-reads the role from the DB on every guard |
| Sequential ID enumeration | UUID primary keys (`defaultRandom()`) |
| Unauthorized access | Edge middleware (`proxy.ts`) gates routes; `requireAuth()` / `requireAdmin()` gate Server Components & Actions |
| Webhook spoofing | Billing Route Handlers verify provider signatures before acting |
| Mass-assignment / bad input | Every Server Action validates with Zod before touching Drizzle |

### Auth & RBAC flow (`lib/auth.ts`, `lib/permissions.ts`, `lib/is-admin.ts`)

- `lib/auth.ts` — `NextAuth({ ... })` with Credentials + Google, DrizzleAdapter for
  persistence, and **JWT** session strategy. `authorize()` looks up the user and
  compares the bcrypt hash; the role is snapshotted into the JWT at sign-in.
- `proxy.ts` — lightweight Edge middleware (Auth.js config **without** the Drizzle
  adapter) that redirects unauthenticated requests. Matcher excludes `api`, static
  assets, and the favicon.
- `lib/permissions.ts` (server-only) — `requireAuth()` / `requireAdmin()` /
  `canEdit` guards that **re-read the live role from the DB** via `getUserById`,
  so a demotion is enforced on the next request.
- `lib/is-admin.ts` (client-safe) — pure `isAdmin(role)` / `canEdit(role)` booleans
  with no server-only imports, usable in Client Components for conditional UI.

## Testing

### Vitest (unit)

DB-free logic is unit-tested next to the source (`lib/**/*.test.ts`), e.g.
`lib/is-admin.test.ts`, `lib/validations/auth.test.ts`, `lib/team-utils.test.ts`.
Pure helpers are deliberately split into `*-utils.ts` so they can be tested
without a database.

```bash
cd next-app
pnpm test            # vitest run — all unit tests
pnpm test:watch      # watch mode
pnpm test:coverage   # v8 coverage (80% gate before merge)
```

### Playwright (e2e)

End-to-end flows live in `e2e/*.spec.ts` (`auth-flow`, `items-crud`,
`dashboard-smoke`, …). They need a seeded DB and a running dev server (the
Playwright `webServer` auto-boots locally).

```bash
cd next-app
pnpm db:seed         # admin@ / editor@ / viewer@ demo users (required for e2e)
pnpm test:e2e        # playwright, chromium project
```

### Migration Commands

```bash
cd next-app
pnpm db:generate     # diff schema -> new SQL file in drizzle/migrations/
pnpm db:migrate      # apply pending migrations
pnpm db:test-migrate # apply against a throwaway DB to validate the migration
```
