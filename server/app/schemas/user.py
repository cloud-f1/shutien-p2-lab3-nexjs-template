import uuid
from datetime import datetime
from typing import Any, Literal

from fastapi_users import schemas
from pydantic import BaseModel, Field, model_validator


class UserRead(schemas.BaseUser[uuid.UUID]):
    display_name: str | None = None
    avatar_url: str | None = None
    # Per the OpenAPI SSOT (UserRead.social_providers, default []). The User ORM
    # has no such column — derive it from the eager-loaded oauth_accounts so the
    # response satisfies the client contract (a missing field broke the client's
    # strict Zod parse → "Sign in failed"). Non-OAuth users → [].
    social_providers: list[Literal["google", "apple"]] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _derive_social_providers(cls, data: Any) -> Any:
        # Only act when validating an ORM User (from_attributes); dict input
        # (already shaped) passes through untouched.
        if isinstance(data, dict) or not hasattr(data, "oauth_accounts"):
            return data
        providers = sorted(
            {
                acc.oauth_name
                for acc in (data.oauth_accounts or [])
                if getattr(acc, "oauth_name", None) in ("google", "apple")
            }
        )
        # Shallow object proxy so Pydantic's attribute access also finds the
        # derived social_providers without mutating the SQLAlchemy instance.
        return _UserAttrs(data, social_providers=providers)


class _UserAttrs:
    """Attribute view over an ORM User that supplies a derived field."""

    def __init__(self, obj: Any, **overrides: Any) -> None:
        self._obj = obj
        self._overrides = overrides

    def __getattr__(self, name: str) -> Any:
        if name in self._overrides:
            return self._overrides[name]
        return getattr(self._obj, name)


class UserCreate(schemas.BaseUserCreate):
    display_name: str | None = Field(default=None, max_length=100)


class UserUpdate(schemas.BaseUserUpdate):
    display_name: str | None = Field(default=None, max_length=100)
    avatar_url: str | None = Field(default=None, max_length=2048)


# ── E161 — unified auth response (replaces client-side adapter) ─────


class AuthResponse(BaseModel):
    """Unified payload for /auth/register, /auth/jwt/login, /auth/refresh."""

    user: UserRead
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserSessionRead(BaseModel):
    """Active session row (E161 session store)."""

    id: uuid.UUID
    created_at: datetime
    last_used_at: datetime
    ip: str | None = None
    user_agent: str | None = None

    model_config = {"from_attributes": True}
