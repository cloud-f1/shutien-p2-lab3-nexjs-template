# Places Domain — Example Implementation

> This is a **reference domain** shipped with the template. Study its patterns, then run `template-cleanup.sh` to remove it.

## Purpose

Demonstrates the full domain pattern: SQLAlchemy model, Pydantic schemas, FastAPI endpoints, ownership checks, and domain auto-registration.

## Architecture Highlights

```
places/
  __init__.py       # Domain auto-registration (router export)
  models.py         # SQLAlchemy model with GUID PK, user FK, team FK
  schemas.py        # Pydantic create/update/response schemas
  endpoints.py      # CRUD endpoints with ownership + team scoping
```

### Key Patterns to Study

- **GUID TypeDecorator**: `id = Column(GUID(), primary_key=True)` — works on both PostgreSQL (native UUID) and SQLite (CHAR(36))
- **Ownership check**: endpoints filter by `user_id` to enforce resource ownership (OWASP A01)
- **Team scoping**: resources belong to teams via `team_id` FK
- **Domain registry**: `__init__.py` exports `router = APIRouter()` — auto-discovered by `server/app/main.py`

## Migration

對應的資料庫 migration 位於 [`docs/examples/migrations/002_places.py`](../../../migrations/002_places.py)。

安裝步驟請參考 [`docs/examples/migrations/README.md`](../../../migrations/README.md)。

## After Studying

Generate your own domain:
```bash
make new-domain NAME=notes
```

Or remove this example:
```bash
bash .github/template-cleanup.sh
```
