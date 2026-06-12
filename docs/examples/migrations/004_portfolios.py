"""Create portfolios and portfolio_places tables — consolidated domain migration

Merges legacy: 004 (create tables) + 005 (text constraints) + 006 (Numeric) + 007 (team_id FK)

Revision ID: 004
Revises: 002, 003
Create Date: 2026-03-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, Sequence[str], None] = ("002", "003")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "portfolios",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
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
            "length(description) <= 2000", name="ck_portfolios_description_len"
        ),
    )
    op.create_index("ix_portfolios_user_id", "portfolios", ["user_id"])
    op.create_index("ix_portfolios_team_id", "portfolios", ["team_id"])

    op.create_table(
        "portfolio_places",
        sa.Column(
            "portfolio_id",
            sa.Uuid(),
            sa.ForeignKey("portfolios.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "place_id",
            sa.Uuid(),
            sa.ForeignKey("places.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "purchase_price",
            sa.Numeric(12, 2),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "current_value",
            sa.Numeric(12, 2),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "length(notes) <= 1000", name="ck_portfolio_places_notes_len"
        ),
        sa.CheckConstraint(
            "purchase_price >= 0", name="ck_portfolio_places_purchase_price_min"
        ),
        sa.CheckConstraint(
            "purchase_price <= 9999999999.99",
            name="ck_portfolio_places_purchase_price_max",
        ),
        sa.CheckConstraint(
            "current_value >= 0", name="ck_portfolio_places_current_value_min"
        ),
        sa.CheckConstraint(
            "current_value <= 9999999999.99",
            name="ck_portfolio_places_current_value_max",
        ),
    )
    op.create_index("ix_portfolio_places_place_id", "portfolio_places", ["place_id"])


def downgrade() -> None:
    op.drop_index("ix_portfolio_places_place_id", table_name="portfolio_places")
    op.drop_table("portfolio_places")
    op.drop_index("ix_portfolios_team_id", table_name="portfolios")
    op.drop_index("ix_portfolios_user_id", table_name="portfolios")
    op.drop_table("portfolios")
