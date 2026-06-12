"""Tests for SoftDeleteMixin — soft delete via deleted_at timestamp."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, GUID
from app.models.mixins.soft_delete import SoftDeleteMixin


# ---------- Concrete test model (no migration needed) ----------


class Article(Base, SoftDeleteMixin):
    __tablename__ = "articles"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), default="")


def _make_article(**overrides) -> Article:
    """Factory helper — creates an Article with sensible defaults."""
    defaults = {"id": uuid.uuid4()}
    defaults.update(overrides)
    return Article(**defaults)


# ---------- Tests ----------


class TestDeletedAtDefault:
    def test_deleted_at_defaults_to_none(self):
        article = _make_article()
        assert article.deleted_at is None


class TestIsDeleted:
    def test_is_deleted_false_by_default(self):
        article = _make_article()
        assert article.is_deleted is False

    def test_is_deleted_true_after_soft_delete(self):
        article = _make_article()
        article.soft_delete()
        assert article.is_deleted is True

    def test_is_deleted_false_after_restore(self):
        article = _make_article()
        article.soft_delete()
        article.restore()
        assert article.is_deleted is False


class TestSoftDelete:
    def test_soft_delete_sets_deleted_at(self):
        article = _make_article()
        before = datetime.now(timezone.utc)
        article.soft_delete()

        assert article.deleted_at is not None
        assert article.deleted_at >= before

    def test_soft_delete_is_idempotent(self):
        article = _make_article()
        article.soft_delete()
        first_ts = article.deleted_at

        # Calling again should not raise — just updates timestamp
        article.soft_delete()
        assert article.deleted_at is not None
        assert article.deleted_at >= first_ts


class TestRestore:
    def test_restore_clears_deleted_at(self):
        article = _make_article()
        article.soft_delete()
        assert article.deleted_at is not None

        article.restore()
        assert article.deleted_at is None
