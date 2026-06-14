# First Epic Walkthrough

> A hands-on guide to building a complete custom domain. Estimated time: **30 minutes**.

## Introduction

After completing this guide, you will have learned:

- The full **Epic-Driven Development** workflow
- **SDD (Spec-Driven Development)** in practice: OpenAPI spec first
- The **Domain Registry** auto-discovery mechanism (E22)
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

### SDD — Spec-Driven Development

**Core Rule**: Always edit `docs/openapi/` BEFORE writing code.

Workflow order:

1. Define the OpenAPI spec (schemas + paths)
2. Generate TypeScript types (`pnpm generate:types`)
3. Implement the backend (FastAPI endpoints)
4. Implement the frontend (React pages + hooks)

### Athena Commands Overview

Here are the most commonly used commands in the development workflow:

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/athena:spec <feature>` | Design a feature spec | Starting a new Epic, defining OpenAPI spec |
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

This is the most critical step. `/athena:domain` is the domain generator created in E23, which follows the SDD workflow — **generating the OpenAPI spec first, then all code**.

Run in Claude Code:

```
/athena:domain bookmark --fields "url:string,title:string,notes:text"
```

### Generated File List

After execution, the generator automatically creates all files in 10 steps:

**OpenAPI Spec** (Step 2 — generated first, SDD compliant):

```
docs/openapi/schemas/bookmark.yaml     # Data structure definitions
docs/openapi/paths/bookmarks.yaml      # API path definitions
docs/openapi/openapi.yaml              # Main file (adds $ref references)
```

**TypeScript Types** (Step 3):

```
client/src/api/types.ts                # Auto-regenerated
```

**Backend Domain Package** (Step 4):

```
server/app/domains/bookmarks/__init__.py    # DomainConfig export
server/app/domains/bookmarks/models.py      # SQLAlchemy model
server/app/domains/bookmarks/schemas.py     # Pydantic schemas
server/app/domains/bookmarks/endpoints.py   # FastAPI router
server/app/models/bookmark.py               # Backward compatibility shim
server/app/schemas/bookmark.py              # Backward compatibility shim
```

**Backend Tests** (Step 6):

```
server/tests/integration/test_bookmarks.py  # Integration tests
```

**Frontend Schemas + Service + Hooks** (Step 7):

```
client/src/schemas/bookmark.ts              # Zod schema
client/src/api/services/bookmarks.ts        # CRUD service
client/src/hooks/useBookmarks.ts            # React Query hooks
```

**Frontend Pages + Tests** (Step 8):

```
client/src/pages/bookmarks/BookmarksPage.tsx       # Page component
client/src/pages/bookmarks/BookmarksPage.test.tsx  # Page tests
client/src/pages/bookmarks/Bookmarks.css           # Page styles
```

**Frontend MSW Handlers** (Step 9):

```
client/src/tests/handlers/bookmarks.ts      # Test mock handlers
```

> **Expected Output**: Claude Code will execute step by step and report the creation result for each file.
> The entire process takes about 2-3 minutes.

---

## Step 3: Inspect the Domain Registry

The **Domain Registry** created in E22 uses an auto-discovery mechanism — you don't need to manually register routes in `main.py`.

### Directory Structure

After generation, the `server/app/domains/` directory looks like this:

```
server/app/domains/
  __init__.py          # DomainConfig + discover_domains()
  places/              # Existing domain
    __init__.py
    models.py
    schemas.py
    endpoints.py
  portfolios/          # Existing domain
    __init__.py
    models.py
    schemas.py
    endpoints.py
  bookmarks/           # Your newly created domain
    __init__.py
    models.py
    schemas.py
    endpoints.py
```

### Auto-Discovery Mechanism

The `discover_domains()` function in `server/app/domains/__init__.py`:

1. Scans all subdirectories under `app/domains/`
2. Attempts to import each sub-package
3. Looks for a module-level `domain_config` attribute (`DomainConfig` type)
4. Automatically registers the router with the FastAPI app

Your `bookmarks/__init__.py` will export a configuration like this:

```python
from app.domains import DomainConfig
from app.domains.bookmarks.endpoints import router
from app.domains.bookmarks.models import Bookmark

domain_config = DomainConfig(
    router=router,
    prefix="/bookmarks",
    tags=["bookmarks"],
    models=[Bookmark],
)
```

> **Key Point**: As long as `domain_config` is correctly exported, the entire domain is automatically loaded.
> Deleting the domain directory = zero broken imports, no need to modify any other files.

---

## Step 4: Run Migration

The generator executes `alembic revision --autogenerate` in Step 5, but you need to verify the migration is correct:

```bash
# Generate migration file (if the generator hasn't already done so)
cd server
uv run alembic revision --autogenerate -m "add bookmarks table"
```

Check the migration file contents (the latest `.py` file in `server/alembic/versions/`) and verify it includes:

- `bookmarks` table creation
- `id` field (UUID primary key)
- `user_id` foreign key (references `users` table)
- `url`, `title`, `notes` fields
- `created_at`, `updated_at` timestamps

Once verified, run the migration:

```bash
uv run alembic upgrade head
```

> **Expected Output**:
>
> ```
> INFO  [alembic.runtime.migration] Running upgrade xxx -> yyy, add bookmarks table
> ```

Return to the project root:

```bash
cd ..
```

---

## Step 5: Run Tests (RED -> GREEN)

TDD spirit: tests first. The generator has already created test files; now let's verify they pass.

### Backend Integration Tests

```bash
cd server
uv run pytest tests/integration/test_bookmarks.py -v
```

> **Expected Output**: All CRUD tests (create, read, update, delete, paginated list) should be PASSED.
>
> ```
> tests/integration/test_bookmarks.py::test_create_bookmark PASSED
> tests/integration/test_bookmarks.py::test_get_bookmark PASSED
> tests/integration/test_bookmarks.py::test_list_bookmarks PASSED
> tests/integration/test_bookmarks.py::test_update_bookmark PASSED
> tests/integration/test_bookmarks.py::test_delete_bookmark PASSED
> ```

Return to the project root:

```bash
cd ..
```

### Frontend Component Tests

```bash
cd client
pnpm test -- --run src/pages/bookmarks/
```

> **Expected Output**: Page component rendering, data loading, and interaction tests should all pass.

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

1. **OpenAPI Spec** — Add the field definition in `docs/openapi/schemas/bookmark.yaml`
2. **Regenerate types** — `cd client && pnpm generate:types`
3. **Model** — Add a `mapped_column` in `server/app/domains/bookmarks/models.py`
4. **Pydantic Schema** — Add the field in `server/app/domains/bookmarks/schemas.py`
5. **Zod Schema** — Add the field in `client/src/schemas/bookmark.ts`
6. **Migration** — `cd server && uv run alembic revision --autogenerate -m "add is_favorite to bookmarks"`
7. **Tests** — Update test cases to verify the new field works correctly

> Remember the SDD order: **OpenAPI -> Server -> Client**.

### Adding a Route to App.tsx

The generator will remind you to manually add the frontend route. In `client/src/App.tsx`, add:

```tsx
import BookmarksPage from './pages/bookmarks/BookmarksPage';

// Add inside <Routes>
<Route path="/bookmarks" element={<ProtectedRoute><BookmarksPage /></ProtectedRoute>} />
```

### Adding a Sidebar Link

Add a bookmark link in the sidebar navigation of `client/src/components/DashboardLayout.tsx`.

### Adjusting Page Styles

Edit `client/src/pages/bookmarks/Bookmarks.css`. This project uses CSS custom properties (design tokens).
All available colour and spacing variables are defined in the theme system (see [TECHSTACK.md](../../../TECHSTACK.md)).

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

- OpenAPI spec for bookmarks endpoints
- Server domain: model, schemas, endpoints
- Client: page, hooks, service, MSW handlers
- Integration + component tests"

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
| **SDD Workflow** | OpenAPI spec first -> TypeScript types -> Backend -> Frontend |
| **Domain Registry** | `discover_domains()` auto-discovery, zero manual registration |
| **Domain Generator** | `/athena:domain` generates 15+ files with one command |
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
- **[OpenAPI Design Patterns](openapi-patterns.md)** — Master the 4 OpenAPI patterns used in this project (CRUD, pagination, nested resources, file upload)
- **[Building Domain Expert Agents](custom-agents.md)** — Create custom AI agents for your business domain
- **[Learning Path](learning-path.md)** — See the full recommended reading order for all guides

---

## Further Reading

| Document | Description |
|----------|-------------|
| [CLAUDE.md](../../../CLAUDE.md) | Project rules, Agent team, Memory system |
| [TECHSTACK.md](../../../TECHSTACK.md) | Full technical architecture (uploadable to any Claude conversation to restore context) |
| [E22 — Domain Registry](../../epics/EPIC_INDEX.md) | Design and implementation of the domain auto-discovery mechanism |
| [E23 — Starter Domain Generator](../../epics/e23-starter-domain-generator.md) | Full spec for the `/athena:domain` generator |
| [Domain Template Directory](../../templates/domain/) | All domain generator template files |
| [Example Domain Configs](../../templates/domain/examples/) | blog.yaml, todo.yaml, crm.yaml examples |
| [Athena Commands Directory](../../../.claude/commands/athena/) | All 17 slash command definitions |
