# Server — Python/FastAPI Conventions

> Sub-project instructions for `server/`. Root rules in `../CLAUDE.md` still apply.

---

## 1. Libraries

- **fastapi-users** for auth — manages users, JWT, OAuth, password reset, email verification
- **httpx-oauth** for Google + GitHub OAuth providers
- **SQLAlchemy 2.x** async with `mapped_column` / `Mapped` type hints
- **Pydantic v2** + `pydantic-settings` for config
- **httpx** `AsyncClient` with `ASGITransport` for test requests
- Python **3.12** minimum (`pyproject.toml` target)
- Package management: **uv** (not pip)

## 2. Pydantic Rules

- Auth schemas extend `fastapi_users.schemas` (BaseUser, BaseUserCreate, BaseUserUpdate)
- Custom schemas in `app/schemas/user.py` — add `display_name`, `avatar_url` fields
- Health/error schemas in `app/schemas/auth.py`
- Derive all schemas from `docs/openapi.yaml` (single source of truth)

## 3. Models

- User inherits `SQLAlchemyBaseUserTableUUID` from `fastapi_users.db`
- OAuthAccount inherits `SQLAlchemyBaseOAuthAccountTableUUID`
- Both use `app/models/base.py` `Base` (DeclarativeBase)
- Custom fields: `display_name`, `avatar_url` on User
- OAuth relationship: `lazy="joined"` for eager loading

## 4. Auth Architecture

- **Stateless JWT** — no server-side sessions, no refresh tokens
- `app/core/auth.py` — FastAPIUsers instance, auth_backend, current_active_user
- `app/services/user_manager.py` — UserManager with email hooks
- `app/db/session.py` — get_user_db dependency
- Routers wired in `app/main.py` via `fastapi_users.get_*_router()`
- Login: `POST /auth/jwt/login` (form-data, `username` field = email)
- Logout: `POST /auth/jwt/logout` → 204

## 5. Testing

- `asyncio_mode = "auto"` in `pyproject.toml` — do NOT add `@pytest.mark.asyncio`
- Test DB: `sqlite+aiosqlite:///./test.db` (override via `TEST_DATABASE_URL` env)
- `concurrency = ["greenlet", "thread"]` in `[tool.coverage.run]` for accurate coverage
- Fixtures: session-scoped `engine`, function-scoped `db` (rollback after each test)
- Override `get_db`, `get_user_db`, AND `get_user_manager` in test client fixture
- Coverage gate: **>= 80%** — blocks deploy if below

## 6. Security

- fastapi-users handles password hashing (argon2 by default via pwdlib)
- JWT algorithm: **HS256** only, secret from `settings.SECRET_KEY`
- Access token: 15 min expiry (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`)
- Forgot-password always returns 202 — **no email enumeration**
