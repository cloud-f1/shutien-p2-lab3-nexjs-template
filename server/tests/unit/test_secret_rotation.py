"""Tests for dual-key JWT verification during secret rotation (E133).

Covers both access tokens (RotatingJWTStrategy) and refresh tokens
(verify_refresh_token) with current-key, previous-key, random-key,
and expired-token scenarios.
"""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import jwt as pyjwt
import pytest

from app.core.auth import RotatingJWTStrategy
from app.core.config import settings
from app.core.tokens import verify_refresh_token

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

CURRENT_SECRET = settings.SECRET_KEY
PREVIOUS_SECRET = "old-secret-key-for-rotation-test"
RANDOM_SECRET = "completely-random-unknown-key"
ALGORITHM = settings.ALGORITHM
AUDIENCE = ["fastapi-users:auth"]


def _make_access_token(secret: str, *, expired: bool = False) -> str:
    """Build a minimal access-style JWT (sub + aud)."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(uuid.uuid4()),
        "aud": AUDIENCE,
        "iat": now,
        "exp": now + timedelta(hours=-1 if expired else 1),
    }
    return pyjwt.encode(payload, secret, algorithm=ALGORITHM)


def _make_refresh_token(secret: str, *, expired: bool = False) -> str:
    """Build a refresh JWT (sub + type + jti)."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(uuid.uuid4()),
        "type": "refresh",
        "jti": uuid.uuid4().hex,
        "iat": now,
        "exp": now + timedelta(hours=-1 if expired else 1),
    }
    return pyjwt.encode(payload, secret, algorithm=ALGORITHM)


def _build_strategy(previous_secret: str = "") -> RotatingJWTStrategy:
    return RotatingJWTStrategy(
        secret=CURRENT_SECRET,
        lifetime_seconds=3600,
        previous_secret=previous_secret,
    )


def _mock_user_manager():
    """Return a mock UserManager that resolves any UUID to a sentinel user."""
    user = AsyncMock()
    user.id = uuid.uuid4()
    mgr = AsyncMock()
    mgr.parse_id = lambda uid: uuid.UUID(uid)
    mgr.get = AsyncMock(return_value=user)
    return mgr, user


# ===================================================================
# Access token — RotatingJWTStrategy.read_token
# ===================================================================


class TestRotatingJWTStrategyReadToken:
    """RotatingJWTStrategy dual-key access token verification."""

    async def test_current_key_succeeds(self):
        strategy = _build_strategy(previous_secret=PREVIOUS_SECRET)
        token = _make_access_token(CURRENT_SECRET)
        mgr, user = _mock_user_manager()

        result = await strategy.read_token(token, mgr)
        assert result is user

    async def test_previous_key_succeeds_when_configured(self):
        strategy = _build_strategy(previous_secret=PREVIOUS_SECRET)
        token = _make_access_token(PREVIOUS_SECRET)
        mgr, user = _mock_user_manager()

        result = await strategy.read_token(token, mgr)
        assert result is user

    async def test_random_key_fails_even_with_previous_set(self):
        strategy = _build_strategy(previous_secret=PREVIOUS_SECRET)
        token = _make_access_token(RANDOM_SECRET)
        mgr, _ = _mock_user_manager()

        result = await strategy.read_token(token, mgr)
        assert result is None

    async def test_expired_token_fails_immediately_no_fallback(self):
        """Expired tokens must not trigger previous-key fallback."""
        strategy = _build_strategy(previous_secret=PREVIOUS_SECRET)
        token = _make_access_token(CURRENT_SECRET, expired=True)
        mgr, _ = _mock_user_manager()

        result = await strategy.read_token(token, mgr)
        assert result is None

    async def test_no_previous_key_no_fallback(self):
        strategy = _build_strategy(previous_secret="")
        token = _make_access_token(PREVIOUS_SECRET)
        mgr, _ = _mock_user_manager()

        result = await strategy.read_token(token, mgr)
        assert result is None

    async def test_none_token_returns_none(self):
        strategy = _build_strategy(previous_secret=PREVIOUS_SECRET)
        mgr, _ = _mock_user_manager()

        result = await strategy.read_token(None, mgr)
        assert result is None


# ===================================================================
# Refresh token — verify_refresh_token
# ===================================================================


class TestRefreshTokenRotation:
    """Dual-key refresh token verification via verify_refresh_token."""

    def test_current_key_succeeds(self):
        token = _make_refresh_token(settings.REFRESH_SECRET_KEY)
        uid = verify_refresh_token(token)
        assert isinstance(uid, uuid.UUID)

    def test_previous_key_succeeds_when_configured(self):
        token = _make_refresh_token(PREVIOUS_SECRET)
        with patch.object(settings, "REFRESH_SECRET_KEY_PREVIOUS", PREVIOUS_SECRET):
            uid = verify_refresh_token(token)
        assert isinstance(uid, uuid.UUID)

    def test_random_key_fails_even_with_previous_set(self):
        token = _make_refresh_token(RANDOM_SECRET)
        with patch.object(settings, "REFRESH_SECRET_KEY_PREVIOUS", PREVIOUS_SECRET):
            with pytest.raises(pyjwt.InvalidSignatureError):
                verify_refresh_token(token)

    def test_expired_token_fails_immediately(self):
        token = _make_refresh_token(settings.REFRESH_SECRET_KEY, expired=True)
        with pytest.raises(pyjwt.ExpiredSignatureError):
            verify_refresh_token(token)

    def test_no_previous_key_no_fallback(self):
        token = _make_refresh_token(PREVIOUS_SECRET)
        with patch.object(settings, "REFRESH_SECRET_KEY_PREVIOUS", ""):
            with pytest.raises(pyjwt.InvalidSignatureError):
                verify_refresh_token(token)
