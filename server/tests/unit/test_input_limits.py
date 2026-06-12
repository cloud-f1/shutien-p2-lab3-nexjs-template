"""Tests for input length limits on schemas and DB constraints."""

import pytest
from pydantic import ValidationError

from app.schemas.user import UserUpdate


def test_avatar_url_max_length_accepted():
    """avatar_url within 2048 chars is accepted."""
    update = UserUpdate(avatar_url="https://example.com/" + "a" * 2000)
    assert update.avatar_url is not None


def test_avatar_url_exceeds_max_length_rejected():
    """avatar_url exceeding 2048 chars is rejected."""
    with pytest.raises(ValidationError):
        UserUpdate(avatar_url="https://example.com/" + "a" * 2040)
