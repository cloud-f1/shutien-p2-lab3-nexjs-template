import uuid

import pytest
from pydantic import ValidationError

from app.schemas.auth import ErrorDetail, ErrorResponse, HealthResponse
from app.schemas.user import UserCreate, UserRead, UserUpdate


# --- UserCreate ---


def test_user_create_valid():
    user = UserCreate(email="test@example.com", password="Str0ng!Pass", display_name="Alice")
    assert user.email == "test@example.com"
    assert user.password == "Str0ng!Pass"
    assert user.display_name == "Alice"


def test_user_create_display_name_max_length():
    with pytest.raises(ValidationError):
        UserCreate(email="a@b.com", password="Pass1234!", display_name="x" * 101)


def test_user_create_requires_email_and_password():
    with pytest.raises(ValidationError):
        UserCreate(display_name="NoEmail")


# --- UserUpdate ---


def test_user_update_partial():
    update = UserUpdate(display_name="NewName")
    assert update.display_name == "NewName"
    assert update.avatar_url is None


def test_user_update_all_optional():
    update = UserUpdate()
    assert update.display_name is None
    assert update.avatar_url is None


# --- UserRead ---


def test_user_read_serialization():
    uid = uuid.uuid4()
    user = UserRead(
        id=uid,
        email="read@example.com",
        is_active=True,
        is_verified=False,
        is_superuser=False,
        display_name="Reader",
    )
    assert user.id == uid
    assert user.email == "read@example.com"
    assert user.display_name == "Reader"


# --- HealthResponse ---


def test_health_response_defaults():
    h = HealthResponse(status="ok")
    assert h.status == "ok"
    assert h.version == "1.0.0"
    assert h.database == "unknown"


def test_health_response_all_fields():
    h = HealthResponse(status="ok", version="1.0.0", database="connected")
    assert h.version == "1.0.0"
    assert h.database == "connected"


# --- ErrorDetail + ErrorResponse ---


def test_error_detail_with_field():
    detail = ErrorDetail(code="INVALID", message="bad input", field="email")
    assert detail.field == "email"


def test_error_detail_without_field():
    detail = ErrorDetail(code="SERVER_ERR", message="oops")
    assert detail.field is None


def test_error_response_nesting():
    resp = ErrorResponse(error=ErrorDetail(code="NOT_FOUND", message="gone"))
    assert resp.error.code == "NOT_FOUND"
    assert resp.error.message == "gone"
