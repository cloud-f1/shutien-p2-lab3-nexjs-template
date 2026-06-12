"""Tests for custom OAuth callback flow (E72)."""

import secrets
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
from urllib.parse import parse_qs, urlparse

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.social import _google_oauth2_authorize_callback
from app.core.config import settings
from app.main import app as fastapi_app
from app.models.session import Session


# ── Helpers ──────────────────────────────────────────────────────────


def _make_state_token(csrf_token: str) -> str:
    """Create a valid state JWT containing the CSRF token."""
    from fastapi_users.router.oauth import generate_state_token

    state_data = {"csrftoken": csrf_token}
    return generate_state_token(state_data, settings.SECRET_KEY)


def _frontend_origin() -> str:
    return settings.ALLOWED_ORIGINS[0] if settings.ALLOWED_ORIGINS else "http://localhost:5173"


def _override_oauth_callback(fake_oauth_token: dict, state: str):
    """Create a dependency override for OAuth2AuthorizeCallback."""

    async def _mock_callback():
        return (fake_oauth_token, state)

    return _mock_callback


# ── Fixtures ─────────────────────────────────────────────────────────


@pytest.fixture()
def oauth_mocks():
    """Context manager factory that sets up OAuth dependency overrides + mocks."""

    class OAuthMockContext:
        def __init__(self, token: dict, state: str, *, id_email=None):
            self.token = token
            self.state = state
            self.id_email = id_email or ("google-123", "oauthuser@example.com")

        async def __aenter__(self):
            async def _mock_cb():
                return (self.token, self.state)

            fastapi_app.dependency_overrides[_google_oauth2_authorize_callback] = _mock_cb
            self._patcher = patch(
                "app.api.v1.endpoints.social.google_oauth.get_id_email",
                new=AsyncMock(return_value=self.id_email),
            )
            self._patcher.start()
            return self

        async def __aexit__(self, *args):
            fastapi_app.dependency_overrides.pop(_google_oauth2_authorize_callback, None)
            self._patcher.stop()

    return OAuthMockContext


# ── Tests ────────────────────────────────────────────────────────────


async def test_google_authorize_returns_url(client: AsyncClient):
    """Google authorize endpoint returns authorization_url."""
    response = await client.get("/auth/google/authorize")
    assert response.status_code == 200
    data = response.json()
    assert "authorization_url" in data


async def test_google_authorize_sets_csrf_cookie(client: AsyncClient):
    """Google authorize endpoint sets the CSRF cookie."""
    response = await client.get("/auth/google/authorize")
    assert response.status_code == 200
    # Check Set-Cookie header for the CSRF cookie
    set_cookie = response.headers.get("set-cookie", "")
    assert "fastapiusersoauthcsrf" in set_cookie


async def test_google_callback_success_redirects_with_tokens(
    client: AsyncClient, db: AsyncSession, oauth_mocks
):
    """Successful OAuth callback redirects to SPA with tokens in fragment."""
    csrf_token = secrets.token_urlsafe(32)
    state = _make_state_token(csrf_token)
    fake_oauth_token = {
        "access_token": "fake-google-access-token",
        "token_type": "bearer",
        "expires_at": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
    }

    async with oauth_mocks(fake_oauth_token, state):
        response = await client.get(
            "/auth/google/callback",
            params={"code": "fake-code", "state": state},
            cookies={"fastapiusersoauthcsrf": csrf_token},
            follow_redirects=False,
        )

    assert response.status_code == 302
    location = response.headers["location"]
    assert f"{_frontend_origin()}/auth/callback#" in location

    # Parse fragment to verify tokens are present
    parsed = urlparse(location)
    fragment_params = parse_qs(parsed.fragment)
    assert "access_token" in fragment_params
    assert "refresh_token" in fragment_params


async def test_google_callback_creates_session(client: AsyncClient, db: AsyncSession, oauth_mocks):
    """OAuth callback creates a server-side session record."""
    csrf_token = secrets.token_urlsafe(32)
    state = _make_state_token(csrf_token)
    fake_oauth_token = {
        "access_token": "fake-google-access-token-session",
        "token_type": "bearer",
        "expires_at": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
    }

    async with oauth_mocks(
        fake_oauth_token, state, id_email=("google-789", "sessioncheck@example.com")
    ):
        response = await client.get(
            "/auth/google/callback",
            params={"code": "fake-code", "state": state},
            cookies={"fastapiusersoauthcsrf": csrf_token},
            follow_redirects=False,
        )

    assert response.status_code == 302

    # Verify session was created
    result = await db.execute(select(Session))
    sessions = result.scalars().all()
    assert len(sessions) >= 1


async def test_google_callback_invalid_state_returns_error_redirect(
    client: AsyncClient, oauth_mocks
):
    """Callback with invalid state token redirects to signin with error."""
    fake_oauth_token = {"access_token": "fake-token", "token_type": "bearer"}

    async with oauth_mocks(fake_oauth_token, "invalid-state-jwt"):
        response = await client.get(
            "/auth/google/callback",
            params={"code": "fake-code", "state": "invalid-state-jwt"},
            cookies={"fastapiusersoauthcsrf": "some-csrf"},
            follow_redirects=False,
        )

    assert response.status_code == 302
    location = response.headers["location"]
    assert "/signin?error=" in location


async def test_google_callback_csrf_mismatch_returns_error_redirect(
    client: AsyncClient, oauth_mocks
):
    """Callback with CSRF mismatch redirects to signin with error."""
    csrf_token = secrets.token_urlsafe(32)
    wrong_csrf = secrets.token_urlsafe(32)
    state = _make_state_token(csrf_token)
    fake_oauth_token = {"access_token": "fake-token", "token_type": "bearer"}

    async with oauth_mocks(fake_oauth_token, state):
        response = await client.get(
            "/auth/google/callback",
            params={"code": "fake-code", "state": state},
            cookies={"fastapiusersoauthcsrf": wrong_csrf},
            follow_redirects=False,
        )

    assert response.status_code == 302
    location = response.headers["location"]
    assert "error=csrf_mismatch" in location


async def test_google_callback_no_csrf_cookie_returns_error(client: AsyncClient, oauth_mocks):
    """Callback without CSRF cookie redirects with error."""
    csrf_token = secrets.token_urlsafe(32)
    state = _make_state_token(csrf_token)
    fake_oauth_token = {"access_token": "fake-token", "token_type": "bearer"}

    async with oauth_mocks(fake_oauth_token, state):
        response = await client.get(
            "/auth/google/callback",
            params={"code": "fake-code", "state": state},
            follow_redirects=False,
        )

    assert response.status_code == 302
    location = response.headers["location"]
    assert "error=" in location


async def test_github_authorize_not_found_when_unconfigured(client: AsyncClient):
    """GitHub authorize returns 404 when GITHUB_CLIENT_ID is not set."""
    if settings.GITHUB_CLIENT_ID:
        return  # can't test disabled state when configured
    response = await client.get("/auth/github/authorize")
    assert response.status_code in (404, 405)
