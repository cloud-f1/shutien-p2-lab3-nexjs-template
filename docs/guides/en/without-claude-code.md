# Working Without Claude Code

> This guide covers the full development workflow using only `pnpm` and standard CLI tools. Claude Code is a **power-up**, not a requirement.

---

## Quick Reference

All `pnpm` commands run from `next-app/`.

| Task | Command |
|------|---------|
| Start the full local stack | `docker compose up --build -d` |
| Start the dev server | `pnpm dev` |
| Create a domain | `make new-domain NAME=notes` |
| Run unit tests | `pnpm test` |
| Run e2e tests | `pnpm test:e2e` |
| Type-check | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Generate a DB migration | `pnpm db:generate` |
| Apply migrations | `pnpm db:migrate` |
| Seed demo accounts | `pnpm db:seed` |

---

## 1. Initial Setup

```bash
# Clone the repo
git clone <your-repo-url>
cd ai-coding-template

# Start the full local stack (Postgres + Next.js app + mailpit)
docker compose up --build -d
```

That's it. `docker compose up --build -d` brings up:
- PostgreSQL
- The Next.js app on http://localhost:3000
- Mailpit (SMTP capture) on http://localhost:8025

Then seed the demo accounts (run from `next-app/`):

```bash
cd next-app
pnpm db:migrate   # apply Drizzle migrations
pnpm db:seed      # create the demo logins below
```

Demo logins: `admin@example.com / Admin123!` · `editor@example.com / Editor123!` · `viewer@example.com / Viewer123!`.

> Prefer running the app directly? From `next-app/`: `pnpm install` then `pnpm dev` (point `DATABASE_URL` at any Postgres instance — the Docker one works too).

## 2. Creating a New Domain

A "domain" is a self-contained feature module with its own table, validation schema, and Server Actions.

```bash
# Create a "notes" domain with a default field (title)
make new-domain NAME=notes
```

This generates:
- `next-app/lib/schema/notes.ts` — a Drizzle table (exported from the `lib/schema/index.ts` barrel)
- `next-app/lib/validations/note.ts` — shared Zod request/response schemas (the contract)
- `next-app/actions/notes.ts` — Server Actions (`"use server"`) for create / update / delete, and/or a Route Handler at `next-app/app/api/notes/route.ts`
- A Drizzle SQL migration for the new table (under `next-app/drizzle/migrations/`)

There's **no central registration**. The App Router is file-system based — the folder under `app/` *is* the route, and Server Actions are imported where they're used. No `main.py`, no router config.

## 3. Customising Your Domain

### Adding Fields

Edit the Drizzle table in `next-app/lib/schema/notes.ts`:

```ts
import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { usersTable } from "./auth"

export const notesTable = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    // Add your fields:
    priority: integer("priority").notNull().default(0),
    isPinned: boolean("is_pinned").notNull().default(false),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("notes_user_id_idx").on(t.userId)],
)

// Types come from Drizzle — no codegen step.
export type Note = typeof notesTable.$inferSelect
export type NewNote = typeof notesTable.$inferInsert
```

Then update the Zod schema in `lib/validations/note.ts`, and generate + apply a migration (run from `next-app/`):

```bash
cd next-app
pnpm db:generate   # writes a SQL migration to drizzle/migrations/
pnpm db:migrate    # applies it to the database
```

### Update the Shared Zod Validation (the contract)

There is no OpenAPI spec and no type-gen. The single source of truth is the shared Zod schema in `next-app/lib/validations/note.ts` — it's consumed by both the Server Actions and the client forms. Types come from `z.infer<typeof ...>` and Drizzle's `$inferSelect` / `$inferInsert`.

Edit the Zod schema **first**, then update the Server Action and the form to match:

```ts
// next-app/lib/validations/note.ts
import { z } from "zod"

export const createNoteSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  priority: z.number().int().default(0),
})

export type CreateNoteInput = z.infer<typeof createNoteSchema>
```

## 4. Testing

All commands run from `next-app/`.

```bash
# Run all unit tests (Vitest)
pnpm test

# Run unit tests with coverage
pnpm test:coverage

# Run a specific test file
pnpm test actions/notes.test.ts

# Run e2e tests (Playwright — seed the DB first)
pnpm db:seed
pnpm test:e2e

# Lint + type-check
pnpm lint
pnpm typecheck
```

### Writing Unit Tests (Vitest)

Create `next-app/actions/notes.test.ts` (or `lib/validations/note.test.ts`):

```ts
import { describe, it, expect } from "vitest"

import { createNoteSchema } from "@/lib/validations/note"

describe("createNoteSchema", () => {
  it("accepts a valid note", () => {
    const result = createNoteSchema.safeParse({ title: "My Note", description: "Hello world" })
    expect(result.success).toBe(true)
  })

  it("rejects an empty title", () => {
    const result = createNoteSchema.safeParse({ title: "" })
    expect(result.success).toBe(false)
  })
})
```

### Writing e2e Tests (Playwright)

Create `next-app/e2e/notes.spec.ts` and run it with `pnpm test:e2e` (after `pnpm db:seed`). Sign in with one of the demo logins — e.g. `editor@example.com / Editor123!` — to exercise a write path.

## 5. Development Workflow

### Daily Development

```bash
# Start the dev server (from next-app/)
cd next-app && pnpm dev

# In another terminal, run tests in watch mode
cd next-app && pnpm test:watch
```

### Adding a New Endpoint

1. Update the shared Zod schema in `lib/validations/note.ts` (the contract)
2. Add or extend the Server Action in `actions/notes.ts` (or the Route Handler in `app/api/notes/route.ts`)
3. Update the Drizzle table in `lib/schema/notes.ts` if the data shape changed
4. Write tests
5. Run `pnpm test` (and `pnpm typecheck`) to verify

### Database Migrations

All commands run from `next-app/`.

```bash
# Generate a migration after editing a Drizzle table
pnpm db:generate   # writes SQL to drizzle/migrations/

# Apply migrations
pnpm db:migrate
```

> Drizzle has no `alembic current` equivalent — to inspect what's been generated, look in `next-app/drizzle/migrations/` (the SQL files and the `meta/_journal.json`).

## 6. Deployment

```bash
# Type-check + lint + tests first (from next-app/)
cd next-app
pnpm typecheck && pnpm lint && pnpm test

# Production build
pnpm build
```

The project is configured for Zeabur deployment — `next-app/` is a single service with its own `zbpack.json`.

## 7. What Claude Code Adds

Claude Code is not required, but it offers these power-ups:

| Feature | Without Claude Code | With Claude Code |
|---------|-------------------|-----------------|
| Create domain | `make new-domain NAME=x` | `/athena:domain notes --fields "title:string,body:text"` |
| Run tests | `pnpm test` | `/athena:qa` (reviews + tests + coverage gate) |
| Deploy | Manual steps | `/athena:deploy` (7-gate protocol) |
| Code review | Manual | `/athena:qa --review-only` |
| Strategic planning | Manual | `/athena:plan` |
| Full dev cycle | Manual steps | `/athena:loop` (advances epic pipeline) |

The AI agents automate the workflow but never replace understanding. Start without Claude Code, add it when you're ready for acceleration.

---

## Troubleshooting

```bash
# Reset the database (drops the Postgres volume, then re-applies + reseeds)
docker compose down -v
docker compose up -d
cd next-app
pnpm db:migrate   # re-apply Drizzle migrations
pnpm db:seed      # re-create the demo accounts

# Type errors? Run the type-checker from next-app/
pnpm typecheck
```

---

## Next Steps

- **[First Epic Walkthrough](first-epic-walkthrough.md)** — Build a complete domain step by step (works with or without Claude Code)
- **[Learning Path](learning-path.md)** — See the full recommended reading order for all guides
