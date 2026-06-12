"""Refresh token utilities — JWT-based with rotation."""

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import settings


def hash_token(token: str) -> str:
    """SHA-256 hash of a token string. Used for session lookup."""
    return hashlib.sha256(token.encode()).hexdigest()


def create_refresh_token(user_id: uuid.UUID) -> str:
    """Create a signed JWT refresh token for the given user."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "jti": uuid.uuid4().hex,
        "iat": now,
        "exp": now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, settings.REFRESH_SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_refresh_token(token: str) -> uuid.UUID:
    """Verify a refresh token and return the user UUID.

    Tries the current REFRESH_SECRET_KEY first. If signature verification fails
    and REFRESH_SECRET_KEY_PREVIOUS is configured, retries with the previous key.
    Only ``jwt.InvalidSignatureError`` triggers the fallback — expired or
    malformed tokens fail immediately.

    Raises jwt.InvalidTokenError on any failure (expired, tampered, wrong type).
    """
    try:
        payload = jwt.decode(token, settings.REFRESH_SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.InvalidSignatureError:
        if not settings.REFRESH_SECRET_KEY_PREVIOUS:
            raise
        payload = jwt.decode(
            token,
            settings.REFRESH_SECRET_KEY_PREVIOUS,
            algorithms=[settings.ALGORITHM],
        )
    if payload.get("type") != "refresh":
        raise jwt.InvalidTokenError("Not a refresh token")
    return uuid.UUID(payload["sub"])
