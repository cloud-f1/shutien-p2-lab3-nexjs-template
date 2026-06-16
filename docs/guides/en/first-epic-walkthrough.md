# First Epic Walkthrough

> A hands-on guide to building a complete custom domain. Estimated time: **30 minutes**.

## Introduction

After completing this guide, you will have learned:

- The full **Epic-Driven Development** workflow
- **Spec-first development** in practice: a shared Zod validation schema as the contract
- The **App Router** file-system routing model (the folder *is* the route)
- How to use the **`/athena:domain`** generator (E23)
- When to use **Athena commands** in the development workflow

### Prerequisites

- Completed the [Quickstart](quickstart.md) and dev server runs successfully
- Claude Code CLI installed (for running Athena slash commands)

---

## Core Concepts Overview

### Epic-Driven Development

All feature development in this project follows the **Epic Pipeline**:

```
spec -> implement -> qa -> commit -> merge
```

Each Epic is an independent feature unit, tracked centrally in [EPIC_INDEX.md](../../epics/EPIC_INDEX.md). No ad-hoc development outside of Epics is allowed.

### Spec-First Development

**Core Rule**: Define the **contract** before writing the implementation. In this stack there is no OpenAPI YAML — the contract is a shared **Zod validation schema** in `next-app/lib/validations/*.ts`, the single source of truth that both Server Actions and client forms import.

Workflow order:

1. Design the feature with `/athena:spec` — produces the epic/spec markdown (`docs/epics/` + `docs/specs/`) plus the shared Zod schema and inferred types in `next-app/lib/validations/`
2. Add the database schema (a Drizzle table in `next-app/db/schema.ts`)
3. Implement the server layer (Server Actions in `next-app/actions/` and/or Route Handlers in `next-app/app/api/`)
4. Implement the UI (async Server Components + client forms)

### Athena Commands Overview

Here are the most commonly used commands in the development workflow:

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/athena:spec <feature>` | Design a feature spec | Starting a new Epic, defining the shared Zod schema + spec |
| `/athena:domain <name>` | Generate complete domain scaffold | Creating a new data domain (model + API + pages) |
| `/athena:implement` | TDD development cycle | Moving from spec to implementation |
| `/athena:qa` | Code review + testing | After implementation, running quality checks |
| `/athena:ship` | Quick publish | Review -> fix -> commit -> PR |
| `/athena:loop` | Epic advancer | Auto-detect and execute the next step |
| `/athena:loop status` | View current state | Check Epic progress |
| `/athena:pr` | Full PR workflow | Merge main -> build -> test -> lint -> PR |
| `/athena:deploy` | Deploy to Zeabur | Deploy after passing 6 check gates |
| `/athena:save` | All agents checkpoint | Save all agent state before ending work |
| `/athena:load` | Load context | Start a new session, restore full state |
| `/athena:plan` | Strategic planning | Audit current state, propose new Epics |
| `/athena:learn` | Memory update | Refresh MEMORY.md, detect knowledge drift |
| `/athena:promote` | Extract reusable insights | Promote project lessons to global memory |

> For the full Agent team description, see [CLAUDE.md](../../../CLAUDE.md).

---

## Scenario Setup

We'll build a **bookmark** (bookmark management) domain as a demonstration.

### Why bookmark?

- Simple and intuitive — only 2-3 fields
- Full CRUD — create, read, update, delete all covered
- No conflict with existing domains (the project already has `places` and `portfolios`)

### Expected Data Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | Bookmark URL |
| `title` | string | Yes | Bookmark title |
| `notes` | text | No | Notes |

> The system automatically adds `id` (UUID primary key), `user_id` (foreign key to user),
> `created_at` and `updated_at` (timestamps) — you don't need to define these manually.

---

## Step 1: Create the Epic Entry

Before starting any development, register a new Epic in [EPIC_INDEX.md](../../epics/EPIC_INDEX.md).

Add a new row to the Epic Step Matrix:

```markdown
| E99 | Bookmark Domain | S | ___ | ___ | ___ | ___ | ___ | Bookmark CRUD |
```

> **Naming Convention**:
>
> - Epic number: `E{number}` (incrementing, use the next available number)
> - Branch name: `feat/E99-bookmark-domain`
> - Commit message: `feat(E99): Bookmark domain CRUD`

Create a feature branch:

```bash
git checkout -b feat/E99-bookmark-domain
```

---

## Step 2: Generate the Scaffold with `/athena:domain`

This is the most critical step. `/athena:domain` is the domain generator created in E23, which follows the spec-first workflow — **generating the shared Zod contract and DB schema first, then the server and UI code**.

Run in Claude Code:

```
/athena:domain bookmark --fields "url:string,title:string,notes:text"
```

### Generated File List

After execution, the generator automatically creates all files, following the spec-first order:

**Spec + shared Zod contract** (generated first):

```
docs/epics/e99-bookmark-domain.md            # Epic + acceptance criteria
docs/specs/bookmark.md                        # Feature spec
next-app/lib/validations/bookmark.ts          # Shared Zod schema + z.infer types (server + client)
```

> Types are **inferred**, not generated from YAML — they come from Drizzle's `$inferSelect`/`$inferInsert` and Zod's `z.infer<typeof bookmarkSchema>`.

**Database schema (Drizzle):**

```
next-app/db/schema.ts                          # Adds the `bookmarks` table definition
```

**Server layer:**

```
next-app/actions/bookmarks.ts                  # Server Actions ("use server") — create/update/delete
next-app/app/api/bookmarks/route.ts            # Route Handler (optional, for read endpoints)
```

**Tests:**

```
next-app/actions/bookmarks.test.ts             # Vitest unit tests (actions + validations)
next-app/e2e/bookmarks.spec.ts                 # Playwright e2e (real seeded DB)
```

**UI (App Router route + modals):**

```
next-app/app/(dashboard)/dashboard/bookmarks/page.tsx   # Async Server Component using <DataTable>
```

> The route also wires modal-based create/edit (shadcn `Dialog`) and delete (`components/confirm-dialog.tsx`)
> per this repo's CRUD convention. Styling is Tailwind classes — there is no per-page `.css` file.

> **Expected Output**: Claude Code will execute step by step and report the creation result for each file.
> The entire process takes about 2-3 minutes.

---

## Step 3: Understand App Router File-System Routing

There is no central route table and no router registration in this stack. **The App Router is file-system routing — the folder you create under `app/` *is* the route.** Server Actions are plain modules you import where you use them; no registry, no `main.py`.

### Directory Structure

After generation, the dashboard route tree looks like this:

```
next-app/app/(dashboard)/dashboard/
  items/               # Existing route (CRUD reference pattern)
    page.tsx
  bookmarks/           # Your newly created route
    page.tsx           # Async Server Component — fetches + renders <DataTable>
```

And the server layer lives alongside the rest of the app:

```
next-app/
  db/schema.ts                   # Drizzle `bookmarks` table
  lib/validations/bookmark.ts    # Shared Zod schema
  actions/bookmarks.ts           # Server Actions ("use server")
  app/api/bookmarks/route.ts     # Optional Route Handler
```

### Why There's No Registration Step

1. Creating the folder `app/(dashboard)/dashboard/bookmarks/` with a `page.tsx` instantly makes `/dashboard/bookmarks` a live route — Next.js discovers it from the file system.
2. Server Actions are imported directly by the components that call them (`import { createBookmark } from "@/actions/bookmarks"`).
3. Route Handlers (`app/api/bookmarks/route.ts`) become the `/api/bookmarks` endpoint just by existing.

Your `actions/bookmarks.ts` will export Server Actions like this:

```ts
"use server";

import { db } from "@/db";
import { bookmarks } from "@/db/schema";
import { bookmarkSchema } from "@/lib/validations/bookmark";
import { revalidatePath } from "next/cache";

export async function createBookmark(input: unknown) {
  const data = bookmarkSchema.parse(input);
  await db.insert(bookmarks).values(data);
  revalidatePath("/dashboard/bookmarks");
  return { ok: true };
}
```

> **Key Point**: The folder *is* the route — no manual wiring. Deleting the `bookmarks/` folder and its
> action/schema files removes the feature cleanly, with no central registry to clean up.

---

## Step 4: Run Migration

The generator adds the `bookmarks` table to `db/schema.ts`, but you need to generate and apply the SQL migration. All commands run from `next-app/`:

```bash
# Generate the SQL migration by diffing db/schema.ts against the DB
cd next-app
pnpm db:generate
```

Check the generated migration file (the latest `.sql` file in `next-app/drizzle/`) and verify it includes:

- `bookmarks` table creation
- `id` field (UUID primary key)
- `user_id` foreign key (references `users` table)
- `url`, `title`, `notes` fields
- `created_at`, `updated_at` timestamps

Once verified, apply the migration:

```bash
pnpm db:migrate
```

> **Expected Output**:
>
> ```
> [✓] migrations applied successfully — added bookmarks table
> ```

Return to the project root:

```bash
cd ..
```

---

## Step 5: Run Tests (RED -> GREEN)

TDD spirit: tests first. The generator has already created test files; now let's verify they pass. All commands run from `next-app/`.

### Unit Tests (Vitest)

These cover the Server Actions and the shared Zod validations:

```bash
cd next-app
pnpm test
```

> **Expected Output**: All CRUD tests (create, read, update, delete, list) should pass.
>
> ```
> ✓ actions/bookmarks.test.ts > createBookmark inserts a row
> ✓ actions/bookmarks.test.ts > getBookmark returns a row
> ✓ actions/bookmarks.test.ts > listBookmarks returns rows
> ✓ actions/bookmarks.test.ts > updateBookmark updates a row
> ✓ actions/bookmarks.test.ts > deleteBookmark removes a row
> ```

### End-to-End Tests (Playwright)

The e2e suite drives the real UI against a real seeded database, so seed it first:

```bash
pnpm db:seed
pnpm test:e2e
```

> **Expected Output**: The bookmarks route renders, the create/edit modals work, and delete is confirmed via the dialog — all green.

Return to the project root:

```bash
cd ..
```

> **If tests fail**: Don't panic — this is the RED phase of TDD.
> Check the error messages, fix the code, and run the tests again.
> You can also use `/athena:qa --test-only` to have the QA Agent analyse the issues.

---

## Step 6: Customisation (Optional)

The generator provides a complete CRUD scaffold that you can further customise according to your needs.

### Adding Fields

For example, to add an `is_favorite` (boolean) field:

1. **Zod Schema** — Add the field to the shared schema in `next-app/lib/validations/bookmark.ts` (this is the contract — update it first)
2. **Drizzle Column** — Add a `boolean("is_favorite")` column to the `bookmarks` table in `next-app/db/schema.ts`
3. **Migration** — `cd next-app && pnpm db:generate && pnpm db:migrate`
4. **Server Action + Form** — Update the Server Action in `actions/bookmarks.ts` and the create/edit form to include the new field
5. **Tests** — Update test cases to verify the new field works correctly

> Remember the spec-first order: **Zod schema (contract) -> Drizzle DB schema -> Server Action -> UI**.
> The Zod schema is the shared contract — keeping it in sync keeps the server and the form honest.

### Adding a Sidebar Link

The App Router has no central route table, so the only manual wiring is the navigation link. Add a bookmarks entry to the dashboard sidebar nav (the shadcn `sidebar-01` nav component used by the dashboard layout) so users can reach `/dashboard/bookmarks`.

### Adjusting Page Styles

Styling is done with Tailwind utility classes directly in the `page.tsx` and form components — there is no per-page `.css` file.
Use the theme's `dark:` variants and design tokens; never add inline `style=` colour overrides (see [TECHSTACK.md](../../../TECHSTACK.md)).

---

## Step 7: Submit with `/athena:ship`

Once feature development is complete and tests pass, use Athena commands to commit and create a PR:

### Option A: Use `/athena:ship`

Run in Claude Code:

```
/athena:ship
```

`/athena:ship` automatically executes:

1. **Review** — Code review
2. **Fix** — Auto-fix discovered issues
3. **Commit** — Create a conventional commit
4. **PR** — Create a Pull Request

### Option B: Manual git Workflow

If you prefer manual operations:

```bash
# Review changes
git status
git diff

# Stage all changes
git add -A

# Create a conventional commit
git commit -m "feat(E99): Bookmark domain CRUD

- Shared Zod schema + Drizzle bookmarks table
- Server Actions + optional Route Handler
- App Router page with <DataTable> + modal CRUD
- Vitest unit tests + Playwright e2e"

# Push and create PR
git push -u origin feat/E99-bookmark-domain
```

### Update EPIC_INDEX

After committing, update the Epic status to complete:

```markdown
| E99 | Bookmark Domain | S | done | done | done | done | ___ | Bookmark CRUD |
```

The `merge` column is only marked as done after the PR is merged.

---

## Completion Review

Congratulations! You've completed a full run through the Epic Pipeline. Let's review what you've learned:

### What You Learned

| Concept | Practice |
|---------|----------|
| **Spec-first** | Shared Zod schema -> Drizzle DB schema -> Server Actions/Route Handlers -> UI |
| **App Router routing** | The folder *is* the route — file-system routing, zero manual registration |
| **Domain Generator** | `/athena:domain` generates the full stack with one command |
| **Epic Pipeline** | spec -> implement -> qa -> commit -> merge |
| **TDD Spirit** | Tests generated alongside implementation, ensuring quality |
| **Athena Commands** | Each development phase has a corresponding automation command |

### What's Next

- **Build More Domains** — Try `/athena:domain todo` or refer to example configs in `docs/templates/domain/examples/` (blog, todo, crm)
- **Dive into Architecture** — Read [TECHSTACK.md](../../../TECHSTACK.md) for full technical decisions
- **View the Roadmap** — Read [EPIC_INDEX.md](../../epics/EPIC_INDEX.md) for all Phase plans
- **Use `/athena:loop`** — Let the Loop command auto-advance the next step of an Epic
- **Use `/athena:plan`** — Let the @strategist Agent audit the current state and propose new Epics

---

## Next Steps

- **[AI Agent Team Guide](ai-agent-team-guide.md)** — Learn serial and parallel execution modes for running multiple epics
- **[Building Domain Expert Agents](custom-agents.md)** — Create custom AI agents for your business domain
- **[Learning Path](learning-path.md)** — See the full recommended reading order for all guides

---

## Further Reading

| Document | Description |
|----------|-------------|
| [CLAUDE.md](../../../CLAUDE.md) | Project rules, Agent team, Memory system |
| [TECHSTACK.md](../../../TECHSTACK.md) | Full technical architecture (uploadable to any Claude conversation to restore context) |
| [CRUD modal + DataTable convention](../../../CLAUDE.md) | The repo's CRUD pattern: modals (Dialog) + reusable `<DataTable>`, reference at `app/(dashboard)/dashboard/items/` |
| [E23 — Starter Domain Generator](../../epics/e23-starter-domain-generator.md) | Full spec for the `/athena:domain` generator |
| [Domain Template Directory](../../templates/domain/) | All domain generator template files |
| [Example Domain Configs](../../templates/domain/examples/) | blog.yaml, todo.yaml, crm.yaml examples |
| [Athena Commands Directory](../../../.claude/commands/athena/) | All 17 slash command definitions |
