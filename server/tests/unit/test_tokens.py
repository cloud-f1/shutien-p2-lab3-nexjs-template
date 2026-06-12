import uuid

import jwt
import pytest

from app.core.config import settings
from app.core.tokens import create_refresh_token, verify_refresh_token


def test_create_refresh_token_is_valid_jwt():
    user_id = uuid.uuid4()
    token = create_refresh_token(user_id)
    payload = jwt.decode(token, settings.REFRESH_SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == str(user_id)
    assert payload["type"] == "refresh"
    assert "jti" in payload
    assert "exp" in payload


def test_verify_refresh_token_roundtrip():
    user_id = uuid.uuid4()
    token = create_refresh_token(user_id)
    result = verify_refresh_token(token)
    assert result == user_id


def test_verify_rejects_access_token_secret():
    """Refresh tokens signed with a different secret can't be verified with the access secret."""
    user_id = uuid.uuid4()
    token = create_refresh_token(user_id)
    with pytest.raises(jwt.InvalidSignatureError):
        jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


def test_verify_rejects_tampered_type():
    """A token with type != 'refresh' is rejected."""
    payload = {
        "sub": str(uuid.uuid4()),
        "type": "access",
        "jti": uuid.uuid4().hex,
    }
    token = jwt.encode(payload, settings.REFRESH_SECRET_KEY, algorithm=settings.ALGORITHM)
    with pytest.raises(jwt.InvalidTokenError, match="Not a refresh token"):
        verify_refresh_token(token)
