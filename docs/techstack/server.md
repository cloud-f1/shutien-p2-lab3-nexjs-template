# Server — FastAPI Tech Stack

## Packages

| Layer | Package | Version | Purpose |
|---|---|---|---|
| Framework | `FastAPI` | 0.115 | Async REST + OpenAPI docs |
| Language | `Python` | 3.12 | Type hints + asyncio |
| Validation | `Pydantic v2` | 2.x | Request/Response schema |
| JWT | `PyJWT` | 2.9 | `import jwt` -- **never** `python-jose` |
| Password | `bcrypt` | 4.x | `import bcrypt` -- **never** `passlib` |
| ORM | `SQLAlchemy 2.x` | 2.x | Async sessions + `Mapped[type]` syntax |
| Migrations | `Alembic` | -- | `--autogenerate` for schema diff |
| Settings | `pydantic-settings` | -- | Typed env vars from `.env` |
| Rate Limit | `slowapi` | -- | 5 req/min on auth routes |
| Testing | `pytest + pytest-asyncio` | -- | `asyncio_mode=auto` |

```python
# Correct imports
import jwt          # PyJWT
import bcrypt       # direct

# NEVER use these
# from jose import jwt
# from passlib.context import CryptContext
```

## API Endpoints

### Auth Routes (`/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | -- | Create account, return token pair |
| `POST` | `/auth/login` | -- | Email + password login |
| `POST` | `/auth/refresh` | -- | Rotate token pair (old token invalidated) |
| `POST` | `/auth/logout` | Bearer | Revoke refresh token |
| `GET` | `/auth/verify-email` | -- | `?token=` email confirmation |
| `POST` | `/auth/forgot-password` | -- | Send reset link (always returns 200) |
| `POST` | `/auth/reset-password` | -- | Set new password with token |
| `GET` | `/auth/social/{provider}` | -- | OAuth2 redirect (google) |
| `GET` | `/auth/social/{provider}/callback` | -- | OAuth2 callback -> JWT |

### User Routes (`/users`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/users/me` | Bearer | Get current user |
| `PATCH` | `/users/me` | Bearer | Update profile |
| `GET` | `/users/me/sessions` | Bearer | List active sessions |
| `DELETE` | `/users/me/sessions/{id}` | Bearer | Terminate session (remote logout) |

### Error Codes

| HTTP | Code | Description |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Request schema mismatch |
| 401 | `INVALID_TOKEN` | JWT invalid or expired |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 403 | `EMAIL_NOT_VERIFIED` | Email not verified |
| 404 | `USER_NOT_FOUND` | User does not exist |
| 429 | `RATE_LIMITED` | Auth route rate limit exceeded |

## Database Design

### Core Tables

```
users
  id              UUID v4  PK
  email           VARCHAR(320) UNIQUE NOT NULL
  password_hash   VARCHAR NULLABLE  <- NULL = social-only account
  is_verified     BOOLEAN DEFAULT FALSE
  display_name    VARCHAR NULLABLE
  created_at      TIMESTAMPTZ (DB trigger)
  updated_at      TIMESTAMPTZ (DB trigger)

sessions
  id              UUID v4 PK
  user_id         UUID FK -> users.id
  refresh_token_hash  VARCHAR NOT NULL
  device_hint     VARCHAR NULLABLE
  expires_at      TIMESTAMPTZ NOT NULL
  created_at      TIMESTAMPTZ

social_accounts
  id              UUID v4 PK
  user_id         UUID FK -> users.id
  provider        VARCHAR(50)    <- 'google'
  provider_user_id VARCHAR(255)
  UNIQUE(provider, provider_user_id)
```

### SQLAlchemy 2.x Pattern

```python
class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"
    email:         Mapped[str]       = mapped_column(String(320), unique=True)
    password_hash: Mapped[str | None]          # nullable = social-only
    is_verified:   Mapped[bool]      = mapped_column(default=False)
    display_name:  Mapped[str | None]
```

### Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Primary Key | UUID v4 | Prevents sequential enumeration |
| `updated_at` | PostgreSQL trigger | Fires even on raw SQL updates |
| Refresh token | DB `sessions` table | Server-side revoke, remote logout |
| Migrations | Alembic `--autogenerate` | Auto-detects ORM vs DB diff |

## Security Architecture

| Threat | Defense |
|---|---|
| XSS token theft | Access token in-memory only; refresh via httpOnly cookie (prod) |
| Refresh token replay | Token rotation -- new pair on every refresh, old invalidated |
| Email enumeration | `forgot-password` always returns 200 |
| Brute force | `slowapi` 5 req/min on auth routes -> 429 + `Retry-After` |
| Sequential ID enumeration | UUID v4 primary keys |
| Unauthorized access | All protected routes require `Depends(get_current_user)` |

## Testing (pytest)

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"   # no @pytest.mark.asyncio needed
testpaths = ["tests"]
addopts = "--strict-markers -q"
```

```bash
cd server
pytest                                        # all tests
pytest --cov=app --cov-report=term-missing    # with coverage
pytest tests/integration/test_auth.py -v      # single file
pytest -k "test_register"                     # filter
# Coverage gate: >= 80% (blocks /athena:deploy if below)
```

### Migration Commands

```bash
alembic upgrade head                                      # apply all
alembic revision --autogenerate -m "add places table"     # generate new
alembic downgrade -1                                      # rollback one
alembic current                                           # check version
```
