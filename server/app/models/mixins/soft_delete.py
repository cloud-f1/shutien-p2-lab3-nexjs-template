"""Soft delete mixin — marks records as deleted instead of removing them.

Usage:
    class Document(Base, SoftDeleteMixin):
        __tablename__ = "documents"
        # ... other columns

    # Soft delete
    document.soft_delete()

    # Query (manual filter required)
    query = select(Document).where(Document.deleted_at.is_(None))
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column


class SoftDeleteMixin:
    """Adds soft delete capability via deleted_at timestamp."""

    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None, index=True
    )

    @hybrid_property
    def is_deleted(self) -> bool:
        """True if the record has been soft-deleted."""
        return self.deleted_at is not None

    @is_deleted.expression  # type: ignore[no-redef]
    def is_deleted(cls):
        """SQL expression for filtering."""
        return cls.deleted_at.isnot(None)

    def soft_delete(self) -> None:
        """Mark the record as deleted."""
        self.deleted_at = datetime.now(timezone.utc)

    def restore(self) -> None:
        """Restore a soft-deleted record."""
        self.deleted_at = None
