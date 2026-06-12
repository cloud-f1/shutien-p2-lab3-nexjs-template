---
name: server-patterns
description: >
  Server-side development patterns for this FastAPI + SQLAlchemy project. Use this skill
  whenever working in server/, writing Python endpoints, models, schemas, services, tests,
  or Alembic migrations. Also use when adding dependencies, configuring middleware, or
  debugging server-side issues. Covers auth (fastapi-users), database patterns, testing
  fixtures, and the dependency injection chain.
---

# Server Patterns — AI-Coding-Template

## Endpoint Structure

One file per domain in `server/app/api/v1/endpoints/`. Each exports a `router = APIRouter()`.
Main app only does `app.include_router(X.router, prefix=..., tags=[...])`.

```python
# server/app/api/v1/endpoints/feature.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.auth import current_active_user

router = APIRouter()

@router.get("/items")
async def list_items(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),  # protected route
):
    result = await db.execute(select(Item).where(Item.owner_id == user.id))
    return result.scalars().all()
```

Register in `main.py`:
```python
from app.api.v1.endpoints import feature
app.include_router(feature.router, prefix="/items", tags=["items"])
```

## Auth — fastapi-users

Custom login/logout endpoints (not fastapi-users auth router) to include refresh tokens.
fastapi-users managed routers used for: register, reset-password, verify, users CRUD.

Key imports:
```python
from app.core.auth import current_active_user, fastapi_users, get_jwt_strategy
from app.core.tokens import create_refresh_token, verify_refresh_token
```

Login uses **form-data** with `username` field = email (OAuth2PasswordRequestForm).

## Auth Libraries (NON-NEGOTIABLE)

```python
import jwt          # PyJWT — NOT python-jose (unmaintained, CVEs)
import bcrypt       # bcrypt direct — NOT passlib (unmaintained since 2023)
```

## Models

```python
from app.models.base import Base, UUIDMixin, TimestampMixin

class MyModel(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "my_table"
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("user.id", ondelete="CASCADE"))
```

- User model: `SQLAlchemyBaseUserTableUUID` — uses `GUID` TypeDecorator (native UUID on PG, CHAR(36) on SQLite)
- OAuth model: `SQLAlchemyBaseOAuthAccountTableUUID`, `lazy="joined"` on relationship

## Schemas (Pydantic)

```python
from pydantic import BaseModel, Field

class ItemCreate(BaseModel):
    name: str = Field(..., max_length=100)

class ItemRead(BaseModel):
    id: str  # UUID as string
    name: str
    model_config = {"from_attributes": True}
```

User schemas extend `fastapi_users.schemas` (BaseUser, BaseUserCreate, BaseUserUpdate).

## Configuration

`pydantic_settings.BaseSettings` in `server/app/core/config.py`.
Env file: `.env`. Production validator rejects default SECRET_KEY.

## Database Session

Dependency chain: `get_db()` → `get_user_db()` → `get_user_manager()`.
All three must be overridden in test fixtures.

## Alembic Migrations

- Naming: `NNN_description.py` (e.g., `001_fastapi_users_initial.py`)
- Startup: `alembic upgrade head && uvicorn ...`
- New migration: `alembic revision --autogenerate -m "description"`
- Full patterns and scenarios: see `dba-migrations` skill

### Migration Type Rules (enforced by linter)

| Column type | Migration type | Default syntax |
|-------------|---------------|----------------|
| UUID PK/FK | `sa.Uuid()` | N/A |
| Boolean | `sa.Boolean()` | `server_default=sa.text("false")` |
| Integer | `sa.Integer()` | `server_default=sa.text("0")` |
| Numeric | `sa.Numeric(P, S)` | `server_default=sa.text("0")` |
| String | `sa.String(N)` | `server_default="value"` |
| DateTime | `sa.DateTime(timezone=True)` | `server_default=sa.func.now()` |

**Banned patterns** (caught by `tests/test_migration_lint.py`):
- `sa.CHAR(36)` or `sa.String(36)` for UUID columns -- use `sa.Uuid()`
- `server_default="0"` or `"1"` on Boolean columns -- use `sa.text("false")` / `sa.text("true")`
- `server_default="0"` on Integer/Numeric columns -- use `sa.text("0")`
- Missing `ondelete` on ForeignKey constraints -- always specify CASCADE/SET NULL/RESTRICT

Add `# noqa: migration-lint` to suppress false positives on intentional patterns.

### FK Ondelete Policy

| Policy | When to use | Example |
|--------|------------|---------|
| `CASCADE` | Child meaningless without parent | `portfolios.user_id` |
| `SET NULL` | Child survives parent deletion | `places.team_id` |
| `RESTRICT` | Prevent accidental parent deletion | `subscriptions.plan_id` |

## Testing

```python
# asyncio_mode = "auto" in pyproject.toml — no @pytest.mark.asyncio needed
# concurrency = ["greenlet", "thread"] in coverage config for async SQLAlchemy

async def test_endpoint(client: AsyncClient):
    response = await client.post("/auth/jwt/login", data={
        "username": "test@example.com",
        "password": "Secure#Pass1",
    })
    assert response.status_code == 200
```

Fixtures: `engine` (session-scoped), `db` (per-test with rollback), `client` (AsyncClient).
Test DB: `sqlite+aiosqlite:///./test.db` (overridable via `TEST_DATABASE_URL` env).
Rate limiter disabled in tests: `limiter.enabled = False`.

## Rate Limiting

slowapi with `app.state.limiter`. Configure per-route:
```python
from app.core.limiter import limiter
@router.post("/endpoint")
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def endpoint(request: Request, ...):
```
