"""Migrate purchase_price and current_value from Float to Numeric(12,2)

Revision ID: 006
Revises: 005
Create Date: 2026-03-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: Alter column types from Float to Numeric(12,2)
    with op.batch_alter_table("portfolio_places") as batch_op:
        batch_op.alter_column(
            "purchase_price",
            existing_type=sa.Float(),
            type_=sa.Numeric(12, 2),
            existing_nullable=False,
            existing_server_default=sa.text("0"),
        )
        batch_op.alter_column(
            "current_value",
            existing_type=sa.Float(),
            type_=sa.Numeric(12, 2),
            existing_nullable=False,
            existing_server_default=sa.text("0"),
        )

    # Step 2: Add check constraints for bounds
    op.create_check_constraint(
        "ck_portfolio_places_purchase_price_min",
        "portfolio_places",
        "purchase_price >= 0",
    )
    op.create_check_constraint(
        "ck_portfolio_places_purchase_price_max",
        "portfolio_places",
        "purchase_price <= 9999999999.99",
    )
    op.create_check_constraint(
        "ck_portfolio_places_current_value_min",
        "portfolio_places",
        "current_value >= 0",
    )
    op.create_check_constraint(
        "ck_portfolio_places_current_value_max",
        "portfolio_places",
        "current_value <= 9999999999.99",
    )


def downgrade() -> None:
    op.drop_constraint("ck_portfolio_places_current_value_max", "portfolio_places", type_="check")
    op.drop_constraint("ck_portfolio_places_current_value_min", "portfolio_places", type_="check")
    op.drop_constraint("ck_portfolio_places_purchase_price_max", "portfolio_places", type_="check")
    op.drop_constraint("ck_portfolio_places_purchase_price_min", "portfolio_places", type_="check")

    with op.batch_alter_table("portfolio_places") as batch_op:
        batch_op.alter_column(
            "purchase_price",
            existing_type=sa.Numeric(12, 2),
            type_=sa.Float(),
            existing_nullable=False,
            existing_server_default=sa.text("0"),
        )
        batch_op.alter_column(
            "current_value",
            existing_type=sa.Numeric(12, 2),
            type_=sa.Float(),
            existing_nullable=False,
            existing_server_default=sa.text("0"),
        )
