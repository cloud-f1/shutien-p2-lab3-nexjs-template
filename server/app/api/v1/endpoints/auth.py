import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

import jwt as pyjwt

from app.core.audit import log_auth_event
from app.core.auth import current_active_user, fastapi_users, get_jwt_strategy
from app.core.config import settings
from app.core.limiter import limiter
from app.core.tokens import create_refresh_token, hash_token, verify_refresh_token
from app.db.session import get_db
from app.models.session import Session
from app.models.user import User
from app.schemas.user import AuthResponse, UserCreate, UserRead, UserSessionRead
from app.services.user_manager import UserManager, get_user_manager
from fastapi_users import exceptions as fau_exc

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────


def _access_ttl_seconds() -> int:
    return settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


async def _issue_token_pair_and_session(
    *,
    user: User,
    db: AsyncSession,
    request: Request,
    family_id: uuid.UUID | None = None,
    parent_hash: str | None = None,
) -> tuple[str, str]:
    """Mint an (access, refresh) pair and persist a Session row.

    Returns the (access_token, refresh_token) tuple. The session is committed
    by the caller's transaction (we ``flush`` here, not ``commit``).
    """
    strategy = get_jwt_strategy()
    access_token = await strategy.write_token(user)
    refresh_token = create_refresh_token(user.id)
    ip = request.client.host if request.client else None
    ua = (request.headers.get("user-agent", "")[:512]) or None
    session = Session(
        user_id=user.id,
        family_id=family_id or uuid.uuid4(),
        token_hash=hash_token(refresh_token),
        parent_hash=parent_hash,
        device_info=(ua or "")[:256],
        user_agent=ua,
        ip_address=ip,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    await db.flush()
    return access_token, refresh_token


def _build_auth_response(*, user: User, access_token: str, refresh_token: str) -> AuthResponse:
    return AuthResponse(
        user=UserRead.model_validate(user, from_attributes=True),
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=_access_ttl_seconds(),
    )


# ── Custom register (E161 — returns unified AuthResponse) ────────────


@router.post("/register", status_code=201, response_model=AuthResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def register(
    request: Request,
    payload: UserCreate,
    user_manager: UserManager = Depends(get_user_manager),
    db: AsyncSession = Depends(get_db),
):
    """Create an account and immediately return a token pair.

    E161: replaces the prior ``UserRead``-only response so the client no longer
    needs an "auto-login after register" adapter.
    """
    try:
        user = await user_manager.create(payload, safe=True, request=request)
    except fau_exc.UserAlreadyExists:
        raise HTTPException(status_code=400, detail="REGISTER_USER_ALREADY_EXISTS")
    except fau_exc.InvalidPasswordException as exc:
        raise HTTPException(status_code=400, detail=str(exc.reason))

    access_token, refresh_token = await _issue_token_pair_and_session(
        user=user, db=db, request=request
    )
    await db.commit()

    log_auth_event(
        "REGISTER_LOGIN",
        user_id=user.id,
        email=user.email,
        ip=request.client.host if request.client else None,
    )
    return _build_auth_response(user=user, access_token=access_token, refresh_token=refresh_token)


# ── Custom login (returns unified AuthResponse + creates session) ───


@router.post("/jwt/login", response_model=AuthResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def login(
    request: Request,
    credentials: OAuth2PasswordRequestForm = Depends(),
    user_manager: UserManager = Depends(get_user_manager),
    db: AsyncSession = Depends(get_db),
):
    user = await user_manager.authenticate(credentials)
    ip = request.client.host if request.client else None
    if user is None or not user.is_active:
        log_auth_event(
            "LOGIN_FAILURE",
            email=credentials.username,
            ip=ip,
            success=False,
        )
        raise HTTPException(status_code=400, detail="LOGIN_BAD_CREDENTIALS")

    access_token, refresh_token = await _issue_token_pair_and_session(
        user=user, db=db, request=request
    )
    await db.commit()

    log_auth_event("LOGIN_SUCCESS", user_id=user.id, email=user.email, ip=ip)

    return _build_auth_response(user=user, access_token=access_token, refresh_token=refresh_token)


# ── Custom logout (revokes session) ──────────────────────────────────


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


@router.post("/jwt/logout", status_code=204)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def logout(
    request: Request,
    body: LogoutRequest = LogoutRequest(),
    _user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if body.refresh_token:
        token_h = hash_token(body.refresh_token)
        await db.execute(
            update(Session)
            .where(Session.token_hash == token_h)
            .values(is_revoked=True, revoked_at=datetime.now(timezone.utc))
        )
        await db.commit()

    log_auth_event(
        "LOGOUT",
        user_id=_user.id,
        ip=request.client.host if request.client else None,
    )
    return None


# ── Refresh with rotation + reuse detection (E161) ───────────────────


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=AuthResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def refresh(
    request: Request,
    body: RefreshRequest,
    user_manager: UserManager = Depends(get_user_manager),
    db: AsyncSession = Depends(get_db),
):
    """Rotate a refresh token. Reuse of an already-rotated RT revokes the
    entire session family (E161 reuse detection)."""
    ip = request.client.host if request.client else None
    try:
        user_id = verify_refresh_token(body.refresh_token)
    except pyjwt.InvalidTokenError:
        log_auth_event(
            "TOKEN_REFRESH_FAILURE",
            ip=ip,
            success=False,
            detail="Invalid token signature",
        )
        raise HTTPException(status_code=401, detail="INVALID_REFRESH_TOKEN")

    old_hash = hash_token(body.refresh_token)
    result = await db.execute(select(Session).where(Session.token_hash == old_hash))
    session = result.scalar_one_or_none()

    # Case A: token unknown — replay of a long-rotated chain.
    if session is None:
        await db.execute(
            update(Session)
            .where(Session.user_id == user_id)
            .values(is_revoked=True, revoked_at=datetime.now(timezone.utc))
        )
        await db.commit()
        log_auth_event(
            "REFRESH_REUSE_DETECTED",
            user_id=user_id,
            ip=ip,
            success=False,
            detail="Unknown refresh token — assuming reuse, revoked all user sessions",
        )
        raise HTTPException(status_code=401, detail="SESSION_REVOKED")

    # Case B: token known but already revoked — classic reuse signal.
    # Revoke the entire family (every descendant of this login).
    if session.is_revoked:
        await db.execute(
            update(Session)
            .where(Session.family_id == session.family_id)
            .values(is_revoked=True, revoked_at=datetime.now(timezone.utc))
        )
        await db.commit()
        log_auth_event(
            "REFRESH_REUSE_DETECTED",
            user_id=user_id,
            ip=ip,
            success=False,
            detail=f"Reuse of revoked RT — entire family {session.family_id} revoked",
        )
        raise HTTPException(status_code=401, detail="SESSION_REVOKED")

    user = await user_manager.get(user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="INVALID_REFRESH_TOKEN")

    # Mark current session revoked, mint new pair, link via parent_hash to
    # preserve the rotation chain inside this family_id.
    now = datetime.now(timezone.utc)
    session.is_revoked = True
    session.revoked_at = now
    session.last_used_at = now

    access_token, new_refresh_token = await _issue_token_pair_and_session(
        user=user,
        db=db,
        request=request,
        family_id=session.family_id,
        parent_hash=old_hash,
    )
    await db.commit()

    log_auth_event("TOKEN_REFRESH", user_id=user.id, ip=ip)

    return _build_auth_response(
        user=user, access_token=access_token, refresh_token=new_refresh_token
    )


# ── Session management endpoints (E161) ──────────────────────────────


@router.get("/sessions", response_model=list[UserSessionRead])
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def list_sessions_v2(
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List active (non-revoked, non-expired) sessions for the current user."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Session)
        .where(
            Session.user_id == user.id,
            Session.is_revoked.is_(False),
            Session.expires_at > now,
        )
        .order_by(Session.last_used_at.desc())
    )
    sessions = result.scalars().all()
    return [
        UserSessionRead(
            id=s.id,
            created_at=s.created_at,
            last_used_at=s.last_used_at,
            ip=s.ip_address,
            user_agent=s.user_agent or s.device_info or None,
        )
        for s in sessions
    ]


@router.delete("/sessions/{session_id}", status_code=204)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def revoke_session_v2(
    session_id: uuid.UUID,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke a single session owned by the current user."""
    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            Session.user_id == user.id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="SESSION_NOT_FOUND")

    await db.execute(
        update(Session)
        .where(Session.id == session_id)
        .values(is_revoked=True, revoked_at=datetime.now(timezone.utc))
    )
    await db.commit()
    log_auth_event(
        "SESSION_REVOKE",
        user_id=user.id,
        ip=request.client.host if request.client else None,
        detail=f"session_id={session_id}",
    )
    return None


@router.post("/logout-all", status_code=204)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def logout_all(
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke every active session for the current user in one transaction."""
    now = datetime.now(timezone.utc)
    await db.execute(
        update(Session)
        .where(Session.user_id == user.id, Session.is_revoked.is_(False))
        .values(is_revoked=True, revoked_at=now)
    )
    await db.commit()
    log_auth_event(
        "LOGOUT_ALL",
        user_id=user.id,
        ip=request.client.host if request.client else None,
    )
    return None


# ── fastapi-users managed routers (reset, verify) ────────────────────
#
# Note: register router intentionally NOT included — E161 replaces it with
# the explicit /register handler above so we can return AuthResponse.

router.include_router(
    fastapi_users.get_reset_password_router(),
)

router.include_router(
    fastapi_users.get_verify_router(UserRead),
)


# ── Dev-only: E2E test helper for email token extraction ─────────

if settings.ENVIRONMENT != "production":
    from app.services.email import console as _console_mod

    @router.get("/test/last-email-token")
    @limiter.limit(settings.RATE_LIMIT_AUTH)
    async def get_last_email_token(request: Request):
        """Return the last email token captured by ConsoleProvider (dev only)."""
        token = _console_mod._last_token
        email = _console_mod._last_token_email
        _console_mod._last_token = None
        _console_mod._last_token_email = None
        return {"token": token, "email": email}
