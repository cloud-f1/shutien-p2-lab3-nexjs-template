"""Create places table — consolidated domain migration

Merges legacy: 003 (create table) + 005 (text constraints) + 007 (team_id FK)

Revision ID: 002
Revises: 001
Create Date: 2026-03-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "places",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("latitude", sa.Float, nullable=False),
        sa.Column("longitude", sa.Float, nullable=False),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "team_id",
            sa.Uuid(),
            sa.ForeignKey("teams.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            "length(description) <= 2000", name="ck_places_description_len"
        ),
    )
    op.create_index("ix_places_user_id", "places", ["user_id"])
    op.create_index("ix_places_lat_lng", "places", ["latitude", "longitude"])
    op.create_index("ix_places_team_id", "places", ["team_id"])


def downgrade() -> None:
    op.drop_index("ix_places_team_id", table_name="places")
    op.drop_index("ix_places_lat_lng", table_name="places")
    op.drop_index("ix_places_user_id", table_name="places")
    op.drop_table("places")
