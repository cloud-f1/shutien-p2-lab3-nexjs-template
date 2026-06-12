"""Add check constraints for text field length limits

Revision ID: 005
Revises: 004
Create Date: 2026-03-13
"""

from typing import Sequence, Union

from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_places_description_len",
        "places",
        "length(description) <= 2000",
    )
    op.create_check_constraint(
        "ck_portfolios_description_len",
        "portfolios",
        "length(description) <= 2000",
    )
    op.create_check_constraint(
        "ck_portfolio_places_notes_len",
        "portfolio_places",
        "length(notes) <= 1000",
    )


def downgrade() -> None:
    op.drop_constraint("ck_portfolio_places_notes_len", "portfolio_places", type_="check")
    op.drop_constraint("ck_portfolios_description_len", "portfolios", type_="check")
    op.drop_constraint("ck_places_description_len", "places", type_="check")
