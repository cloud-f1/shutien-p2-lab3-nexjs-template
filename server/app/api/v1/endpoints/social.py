import logging
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import RedirectResponse
from httpx_oauth.clients.google import GoogleOAuth2
from httpx_oauth.integrations.fastapi import OAuth2AuthorizeCallback
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_jwt_strategy
from app.core.audit import log_auth_event
from app.core.config import settings
from app.core.tokens import create_refresh_token, hash_token
from app.db.session import get_db
from app.models.session import Session
from app.services.user_manager import UserManager, get_user_manager

logger = logging.getLogger(__name__)

router = APIRouter()

# ── OAuth clients ────────────────────────────────────────────────────

google_oauth = GoogleOAuth2(settings.GOOGLE_CLIENT_ID, settings.GOOGLE_CLIENT_SECRET)

github_oauth = None
if settings.GITHUB_CLIENT_ID:
    from httpx_oauth.clients.github import GitHubOAuth2

    github_oauth = GitHubOAuth2(settings.GITHUB_CLIENT_ID, settings.GITHUB_CLIENT_SECRET)

# ── Constants (from fastapi-users internals) ─────────────────────────

_CSRF_COOKIE_NAME = "fastapiusersoauthcsrf"
_CSRF_TOKEN_KEY = "csrftoken"
_STATE_TOKEN_AUDIENCE = "fastapi-users:oauth-state"

# ── Helper: frontend origin ──────────────────────────────────────────

_FRONTEND_ORIGIN = (
    settings.ALLOWED_ORIGINS[0] if settings.ALLOWED_ORIGINS else "http://localhost:5173"
)


# ── Response model ───────────────────────────────────────────────────


class OAuth2AuthorizeResponse(BaseModel):
    authorization_url: str


# ── Helper: build redirect URLs ──────────────────────────────────────


def _success_redirect(access_token: str, refresh_token: str) -> RedirectResponse:
    """Redirect to SPA callback page with tokens in URL fragment."""
    fragment = urlencode({"access_token": access_token, "refresh_token": refresh_token})
    url = f"{_FRONTEND_ORIGIN}/auth/callback#{fragment}"
    return RedirectResponse(url=url, status_code=302)


def _error_redirect(error: str = "oauth_failed") -> RedirectResponse:
    """Redirect to sign-in page with error query param."""
    url = f"{_FRONTEND_ORIGIN}/signin?error={error}"
    return RedirectResponse(url=url, status_code=302)


# ── Helper: generate authorize URL (replaces get_oauth_router authorize) ─


async def _authorize(
    oauth_client,
    callback_route_name: str,
    request: Request,
    response: Response,
    scopes: list[str] | None = None,
) -> OAuth2AuthorizeResponse:
    """Generate OAuth authorization URL and set CSRF cookie."""
    from fastapi_users.router.oauth import generate_csrf_token, generate_state_token

    redirect_url = str(request.url_for(callback_route_name))
    csrf_token = generate_csrf_token()
    state_data = {_CSRF_TOKEN_KEY: csrf_token}
    state = generate_state_token(state_data, settings.SECRET_KEY)
    authorization_url = await oauth_client.get_authorization_url(redirect_url, state, scopes)

    response.set_cookie(
        _CSRF_COOKIE_NAME,
        csrf_token,
        max_age=3600,
        path="/",
        secure=True,
        httponly=True,
        samesite="lax",
    )

    return OAuth2AuthorizeResponse(authorization_url=authorization_url)


# ── Helper: process OAuth callback (shared by Google + GitHub) ───────


async def _handle_oauth_callback(
    *,
    oauth_client_name: str,
    oauth_client,
    access_token_state: tuple,
    request: Request,
    user_manager: UserManager,
    db: AsyncSession,
) -> RedirectResponse:
    """Shared logic for OAuth callback: validate CSRF, create/associate user,
    create session, generate tokens, redirect to SPA."""
    from fastapi_users.jwt import decode_jwt

    token, state = access_token_state

    # Decode + validate state JWT
    try:
        state_data = decode_jwt(state, settings.SECRET_KEY, [_STATE_TOKEN_AUDIENCE])
    except Exception:
        logger.warning("OAuth callback: invalid state token")
        return _error_redirect("invalid_state")

    # CSRF validation
    cookie_csrf = request.cookies.get(_CSRF_COOKIE_NAME)
    state_csrf = state_data.get(_CSRF_TOKEN_KEY)
    if not cookie_csrf or not state_csrf or not secrets.compare_digest(cookie_csrf, state_csrf):
        logger.warning("OAuth callback: CSRF mismatch")
        return _error_redirect("csrf_mismatch")

    # Get account info from provider
    try:
        account_id, account_email = await oauth_client.get_id_email(token["access_token"])
    except Exception:
        logger.exception("OAuth callback: failed to get user info from provider")
        return _error_redirect()

    if account_email is None:
        return _error_redirect("no_email")

    # Create or associate user via fastapi-users
    try:
        user = await user_manager.oauth_callback(
            oauth_client_name,
            token["access_token"],
            account_id,
            account_email,
            token.get("expires_at"),
            token.get("refresh_token"),
            request,
            associate_by_email=True,
            is_verified_by_default=True,
        )
    except Exception:
        logger.exception("OAuth callback: user creation/association failed")
        return _error_redirect()

    if not user.is_active:
        return _error_redirect("user_inactive")

    # Generate access + refresh tokens
    strategy = get_jwt_strategy()
    access_token = await strategy.write_token(user)
    refresh_token = create_refresh_token(user.id)

    # Create server-side session (same pattern as custom login in auth.py)
    ip = request.client.host if request.client else None
    session = Session(
        user_id=user.id,
        token_hash=hash_token(refresh_token),
        device_info=(request.headers.get("user-agent", "")[:256]),
        ip_address=ip,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    await db.commit()

    log_auth_event(
        "OAUTH_LOGIN",
        user_id=user.id,
        email=user.email,
        ip=ip,
        detail=f"provider={oauth_client_name}",
    )

    return _success_redirect(access_token, refresh_token)


# ── Google OAuth endpoints ───────────────────────────────────────────

_google_callback_route_name = "oauth:google.callback"

_google_oauth2_authorize_callback = OAuth2AuthorizeCallback(
    google_oauth,
    route_name=_google_callback_route_name,
)


@router.get(
    "/google/authorize",
    response_model=OAuth2AuthorizeResponse,
)
async def google_authorize(
    request: Request,
    response: Response,
    scopes: list[str] = Query(None),
):
    return await _authorize(google_oauth, _google_callback_route_name, request, response, scopes)


@router.get("/google/callback", name=_google_callback_route_name)
async def google_callback(
    request: Request,
    access_token_state=Depends(_google_oauth2_authorize_callback),
    user_manager: UserManager = Depends(get_user_manager),
    db: AsyncSession = Depends(get_db),
):
    return await _handle_oauth_callback(
        oauth_client_name="google",
        oauth_client=google_oauth,
        access_token_state=access_token_state,
        request=request,
        user_manager=user_manager,
        db=db,
    )


# ── GitHub OAuth endpoints ───────────────────────────────────────────

if github_oauth is not None:
    _github_callback_route_name = "oauth:github.callback"

    _github_oauth2_authorize_callback = OAuth2AuthorizeCallback(
        github_oauth,
        route_name=_github_callback_route_name,
    )

    @router.get(
        "/github/authorize",
        response_model=OAuth2AuthorizeResponse,
    )
    async def github_authorize(
        request: Request,
        response: Response,
        scopes: list[str] = Query(None),
    ):
        return await _authorize(
            github_oauth, _github_callback_route_name, request, response, scopes
        )

    @router.get("/github/callback", name=_github_callback_route_name)
    async def github_callback(
        request: Request,
        access_token_state=Depends(_github_oauth2_authorize_callback),
        user_manager: UserManager = Depends(get_user_manager),
        db: AsyncSession = Depends(get_db),
    ):
        return await _handle_oauth_callback(
            oauth_client_name="github",
            oauth_client=github_oauth,
            access_token_state=access_token_state,
            request=request,
            user_manager=user_manager,
            db=db,
        )
