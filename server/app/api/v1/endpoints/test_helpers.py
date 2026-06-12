"""Triple-guarded test-helper endpoints for E2E seeding (E150).

Gate 1: ENABLE_TEST_HELPERS env var must be true  → 404 if disabled
Gate 2: ENVIRONMENT must not be "production"      → 403 if production
Gate 3: JWT authentication required               → 401 if no valid token
"""

import logging

from fastapi import APIRouter, Depends, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_active_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.services.user_manager import get_user_manager

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Request / Response schemas ─────────────────────────────────


class TestSeedRequest(BaseModel):
    email: EmailStr
    password: str
    is_superuser: bool = False


class TestSeedResponse(BaseModel):
    id: str
    email: str
    is_superuser: bool
    created: bool


class TestResetRequest(BaseModel):
    email: EmailStr


# ── Gate dependency ────────────────────────────────────────────


def _check_test_helpers_enabled() -> None:
    """Gates 1 & 2: env var + non-production check."""
    if not settings.ENABLE_TEST_HELPERS:
        # Gate 1 — feature flag off → pretend endpoint doesn't exist
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    if settings.ENVIRONMENT == "production":
        # Gate 2 — production environment → hard block
        return JSONResponse(
            status_code=403,
            content={
                "error": {
                    "type": "forbidden_error",
                    "code": "TEST_HELPERS_BLOCKED",
                    "message": "Test helpers are disabled in production",
                }
            },
        )
    return None


# ── Endpoints ──────────────────────────────────────────────────


@router.post("/seed")
async def seed_test_user(
    body: TestSeedRequest,
    _user: User = Depends(current_active_user),  # Gate 3: JWT
    db: AsyncSession = Depends(get_db),
    user_manager=Depends(get_user_manager),
):
    """Create or return an existing test user. Idempotent by email."""
    # Gates 1 & 2
    gate_response = _check_test_helpers_enabled()
    if gate_response is not None:
        return gate_response

    # Check if user already exists
    result = await db.execute(select(User).where(User.email == body.email))
    existing = result.unique().scalar_one_or_none()

    if existing is not None:
        return JSONResponse(
            status_code=200,
            content=TestSeedResponse(
                id=str(existing.id),
                email=existing.email,
                is_superuser=existing.is_superuser,
                created=False,
            ).model_dump(),
        )

    # Create new user via user_manager (handles hashing, validation)
    from fastapi_users.schemas import BaseUserCreate

    user_create = BaseUserCreate(
        email=body.email,
        password=body.password,
        is_superuser=body.is_superuser,
        is_active=True,
        is_verified=True,
    )
    new_user = await user_manager.create(user_create)
    logger.info("Test helper seeded user %s (%s)", new_user.id, body.email)

    return JSONResponse(
        status_code=201,
        content=TestSeedResponse(
            id=str(new_user.id),
            email=new_user.email,
            is_superuser=new_user.is_superuser,
            created=True,
        ).model_dump(),
    )


@router.post("/reset", status_code=204)
async def reset_test_user(
    body: TestResetRequest,
    _user: User = Depends(current_active_user),  # Gate 3: JWT
    db: AsyncSession = Depends(get_db),
    user_manager=Depends(get_user_manager),
):
    """Delete a seeded test user by email. Idempotent — no error if missing."""
    # Gates 1 & 2
    gate_response = _check_test_helpers_enabled()
    if gate_response is not None:
        return gate_response

    result = await db.execute(select(User).where(User.email == body.email))
    existing = result.unique().scalar_one_or_none()

    if existing is not None:
        await user_manager.delete(existing)
        logger.info("Test helper deleted user %s (%s)", existing.id, body.email)

    return Response(status_code=204)
