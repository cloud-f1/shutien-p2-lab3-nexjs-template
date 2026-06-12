# Working Without Claude Code

> This guide covers the full development workflow using only `make` commands and standard CLI tools. Claude Code is a **power-up**, not a requirement.

---

## Quick Reference

| Task | Command |
|------|---------|
| Start everything | `make go` |
| Create a domain | `make new-domain NAME=notes` |
| Run all tests | `make test` |
| Run server tests | `make test-server` |
| Run client tests | `make test-client` |
| Check environment | `make doctor` |
| Interactive tutorial | `make tutorial` |

---

## 1. Initial Setup

```bash
# Clone the repo
git clone <your-repo-url>
cd ai-coding-template

# Start everything (installs deps, starts DB, runs migrations, launches dev servers)
make go
```

That's it. `make go` handles:
- Checking prerequisites (Node, pnpm, Python, uv, Docker)
- Generating `.env` with random secrets
- Installing Python and Node dependencies
- Starting PostgreSQL via Docker
- Running database migrations
- Generating TypeScript types from the OpenAPI spec
- Starting both the API server and the client dev server

## 2. Creating a New Domain

A "domain" is a self-contained feature module with its own model, endpoints, schemas, and tests.

```bash
# Create a "notes" domain with default fields (name + description)
make new-domain NAME=notes
```

This generates:
- `server/app/domains/notes/models.py` — SQLAlchemy model
- `server/app/domains/notes/schemas.py` — Pydantic request/response schemas
- `server/app/domains/notes/endpoints.py` — CRUD endpoints (list, create, read, update, delete)
- `server/app/domains/notes/__init__.py` — Domain registration (auto-discovered)
- An Alembic migration for the new database table

The domain is **auto-registered** — no need to edit `main.py` or any router configuration.

## 3. Customising Your Domain

### Adding Fields

Edit `server/app/domains/notes/models.py`:

```python
class Note(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "notes"

    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    # Add your fields:
    priority: Mapped[int] = mapped_column(Integer, default=0)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
```

Then update the schemas in `schemas.py` and generate a new migration:

```bash
cd server
uv run alembic revision --autogenerate -m "add fields to notes"
uv run alembic upgrade head
```

### Updating the OpenAPI Spec

For a complete Spec-Driven Development (SDD) workflow, edit `docs/openapi.yaml` **first**, then update the server code to match. This keeps the API contract as the single source of truth.

## 4. Testing

```bash
# Run all tests (server + client)
make test

# Run just server tests with coverage
make test-server

# Run just client tests with coverage
make test-client

# Run a specific test file
cd server && uv run pytest tests/integration/test_notes.py -v

# Lint everything
make lint
```

### Writing Server Tests

Create `server/tests/integration/test_notes.py`:

```python
import pytest
from httpx import AsyncClient


async def test_create_note(auth_client: AsyncClient):
    res = await auth_client.post(
        "/api/v1/notes/",
        json={"name": "My Note", "description": "Hello world"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "My Note"


async def test_list_notes(auth_client: AsyncClient):
    res = await auth_client.get("/api/v1/notes/")
    assert res.status_code == 200
    assert "items" in res.json()
```

## 5. Development Workflow

### Daily Development

```bash
# Start the dev environment
make go

# In another terminal, run tests in watch mode
cd client && pnpm test
```

### Adding a New Endpoint

1. (Optional) Edit `docs/openapi.yaml` to define the new endpoint
2. Add the route in your domain's `endpoints.py`
3. Update schemas if needed
4. Write tests
5. Run `make test` to verify

### Database Migrations

```bash
# Generate a migration after model changes
cd server && uv run alembic revision --autogenerate -m "describe your change"

# Apply migrations
cd server && uv run alembic upgrade head

# Check migration status
cd server && uv run alembic current
```

## 6. Deployment

```bash
# Run the diagnostics check first
make doctor

# Run the full test suite
make test

# Build the client
cd client && pnpm build
```

The project is configured for Zeabur deployment. Each service (server + client) has its own `zbpack.json` configuration.

## 7. What Claude Code Adds

Claude Code is not required, but it offers these power-ups:

| Feature | Without Claude Code | With Claude Code |
|---------|-------------------|-----------------|
| Create domain | `make new-domain NAME=x` | `/athena:domain notes --fields "title:string,body:text"` |
| Run tests | `make test` | `/athena:qa` (reviews + tests + coverage gate) |
| Deploy | Manual steps | `/athena:deploy` (6-gate protocol) |
| Code review | Manual | `/athena:qa --review-only` |
| Strategic planning | Manual | `/athena:plan` |
| Full dev cycle | Manual steps | `/athena:loop` (advances epic pipeline) |

The AI agents automate the workflow but never replace understanding. Start without Claude Code, add it when you're ready for acceleration.

---

## Troubleshooting

```bash
# Full environment diagnostic
make doctor

# Check prerequisites only
make check-prereqs

# Reset the database
make db-stop && make db && cd server && uv run alembic upgrade head

# Regenerate TypeScript types
cd client && pnpm generate:types
```

---

## Next Steps

- **[First Epic Walkthrough](first-epic-walkthrough.md)** — Build a complete domain step by step (works with or without Claude Code)
- **[CI Pipeline Explained](ci-explained.md)** — Understand the automated checks that run on every push
- **[OpenAPI Design Patterns](openapi-patterns.md)** — Learn the 4 API patterns used in this project
- **[Learning Path](learning-path.md)** — See the full recommended reading order for all guides
