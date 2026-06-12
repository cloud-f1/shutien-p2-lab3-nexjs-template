from fastapi_users.db import SQLAlchemyBaseOAuthAccountTableUUID, SQLAlchemyBaseUserTableUUID
from sqlalchemy import DateTime
from sqlalchemy import inspect as sa_inspect

from app.models.base import TimestampMixin
from app.models.user import OAuthAccount, User


# --- UUIDMixin ---


def test_uuid_mixin_generates_valid_uuid():
    """User model id column has a callable default that generates UUIDs."""
    mapper = sa_inspect(User)
    id_col = mapper.columns["id"]
    assert id_col.default is not None
    assert callable(id_col.default.arg)


def test_uuid_mixin_column_is_string():
    mapper = sa_inspect(User)
    id_col = mapper.columns["id"]
    # fastapi-users uses CHAR(36) for UUID
    assert (
        "CHAR" in str(id_col.type) or "VARCHAR" in str(id_col.type) or "String" in str(id_col.type)
    )


def test_uuid_mixin_is_primary_key():
    mapper = sa_inspect(User)
    id_col = mapper.columns["id"]
    assert id_col.primary_key is True


# --- TimestampMixin ---


def test_timestamp_mixin_has_created_at():
    mc = TimestampMixin.__dict__["created_at"]
    col = mc.column
    assert isinstance(col.type, DateTime)
    assert col.type.timezone is True


def test_timestamp_mixin_has_updated_at():
    mc = TimestampMixin.__dict__["updated_at"]
    col = mc.column
    assert isinstance(col.type, DateTime)
    assert col.type.timezone is True


# --- User model ---


def test_user_inherits_base_user():
    assert issubclass(User, SQLAlchemyBaseUserTableUUID)


def test_user_has_custom_fields():
    mapper = sa_inspect(User)
    col_names = [c.key for c in mapper.columns]
    assert "display_name" in col_names
    assert "avatar_url" in col_names


def test_user_has_oauth_relationship():
    mapper = sa_inspect(User)
    assert "oauth_accounts" in mapper.relationships


# --- OAuthAccount model ---


def test_oauth_account_inherits_base():
    assert issubclass(OAuthAccount, SQLAlchemyBaseOAuthAccountTableUUID)
