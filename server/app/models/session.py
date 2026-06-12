"""Server-side session tracking for refresh token management.

E161: extended with ``family_id``, ``parent_hash``, ``revoked_at``, and
``user_agent`` columns to support refresh-token rotation chains and
reuse-detection (revoke entire family on detected reuse).
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import GUID, Base, TimestampMixin, UUIDMixin


class Session(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
    # E161: rotation family — all sessions descended from one login share this id.
    # On detected reuse, every row with this family_id is revoked at once.
    family_id: Mapped[uuid.UUID] = mapped_column(GUID(), index=True, default=uuid.uuid4)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    # E161: pointer to the previous token hash in the rotation chain (null for the
    # first session in a family). Lets us audit a family's full lineage.
    parent_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    device_info: Mapped[str] = mapped_column(String(256), server_default="")
    # E161: explicit user_agent column (separate from device_info, which historically
    # held the same value). Kept for backward compatibility — both populated.
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_used_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    is_revoked: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    # E161: precise revocation timestamp — `is_revoked` flag stays for back-compat.
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
