"""Add nullable team_id FK to places and portfolios

Revision ID: 007
Revises: 006b
Create Date: 2026-03-14
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "places",
        sa.Column(
            "team_id",
            sa.Uuid(),
            sa.ForeignKey("teams.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_places_team_id", "places", ["team_id"])

    op.add_column(
        "portfolios",
        sa.Column(
            "team_id",
            sa.Uuid(),
            sa.ForeignKey("teams.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_portfolios_team_id", "portfolios", ["team_id"])


def downgrade() -> None:
    op.drop_index("ix_portfolios_team_id", table_name="portfolios")
    op.drop_column("portfolios", "team_id")
    op.drop_index("ix_places_team_id", table_name="places")
    op.drop_column("places", "team_id")
