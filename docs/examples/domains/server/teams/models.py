"""Team & TeamMember models — RBAC team scoping."""

import uuid
from enum import Enum

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import GUID, Base, TimestampMixin, UUIDMixin


class Role(str, Enum):
    viewer = "viewer"  # read-only access
    editor = "editor"  # read + write resources
    admin = "admin"  # manage members + resources
    owner = "owner"  # full control, can delete team


# Numeric hierarchy for comparison: higher = more privilege
ROLE_HIERARCHY: dict[Role, int] = {
    Role.viewer: 0,
    Role.editor: 1,
    Role.admin: 2,
    Role.owner: 3,
}


def role_gte(user_role: Role, min_role: Role) -> bool:
    """Return True if user_role >= min_role in the hierarchy."""
    return ROLE_HIERARCHY[user_role] >= ROLE_HIERARCHY[min_role]


class Team(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "teams"

    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    members: Mapped[list["TeamMember"]] = relationship(
        back_populates="team", cascade="all, delete-orphan", lazy="noload"
    )


class TeamMember(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "team_members"

    team_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("teams.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(20))

    team: Mapped["Team"] = relationship(back_populates="members", lazy="selectin")
    user = relationship("User", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("team_id", "user_id", name="uq_team_member"),
        CheckConstraint(
            "role IN ('viewer', 'editor', 'admin', 'owner')",
            name="ck_team_members_role",
        ),
    )
