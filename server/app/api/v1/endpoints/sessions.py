"""Session management endpoints — list and revoke active sessions."""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_active_user
from app.core.config import settings
from app.core.limiter import limiter
from app.db.session import get_db
from app.models.session import Session
from app.models.user import User
from app.schemas.session import SessionRead

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/", response_model=list[SessionRead])
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def list_sessions(
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Session).where(
            Session.user_id == user.id,
            Session.is_revoked.is_(False),
            Session.expires_at > now,
        )
    )
    sessions = result.scalars().all()
    logger.info("list_sessions", extra={"user_id": str(user.id), "count": len(sessions)})
    return [
        SessionRead(
            id=s.id,
            device_info=s.device_info,
            ip_address=s.ip_address,
            created_at=s.created_at,
            last_used_at=s.last_used_at,
            expires_at=s.expires_at,
            is_current=False,  # caller doesn't send refresh token here
        )
        for s in sessions
    ]


@router.delete("/{session_id}", status_code=204)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def revoke_session(
    session_id: uuid.UUID,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            Session.user_id == user.id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="SESSION_NOT_FOUND")

    await db.execute(update(Session).where(Session.id == session_id).values(is_revoked=True))
    await db.commit()
    logger.info(
        "revoke_session",
        extra={"user_id": str(user.id), "session_id": str(session_id)},
    )
    return None
