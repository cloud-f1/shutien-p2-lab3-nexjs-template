"""Add billing tables (subscription_plans, subscriptions, webhook_events) and
stripe_customer_id to teams.

Revision ID: 008
Revises: 007
Create Date: 2026-03-14
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add stripe_customer_id to teams table
    op.add_column("teams", sa.Column("stripe_customer_id", sa.String(255), nullable=True))

    # Create subscription_plans table
    op.create_table(
        "subscription_plans",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("stripe_price_id", sa.String(255), nullable=True),
        sa.Column("amount", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("currency", sa.String(10), nullable=False, server_default="usd"),
        sa.Column("interval", sa.String(20), nullable=False, server_default="month"),
        sa.Column("features", sa.Text, nullable=False, server_default="{}"),
        sa.Column("limits", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("display_order", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_subscription_plans_slug", "subscription_plans", ["slug"])

    # Create subscriptions table
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "team_id",
            sa.Uuid(),
            sa.ForeignKey("teams.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "plan_id",
            sa.Uuid(),
            sa.ForeignKey("subscription_plans.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("stripe_subscription_id", sa.String(255), nullable=True),
        sa.Column("stripe_customer_id", sa.String(255), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="free"),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "cancel_at_period_end", sa.Boolean, nullable=False, server_default=sa.text("false")
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_subscriptions_team_id", "subscriptions", ["team_id"])
    op.create_index("ix_subscriptions_plan_id", "subscriptions", ["plan_id"])

    # Create webhook_events table
    op.create_table(
        "webhook_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("stripe_event_id", sa.String(255), nullable=False, unique=True),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_webhook_events_stripe_event_id", "webhook_events", ["stripe_event_id"])

    # Seed free plan
    op.execute(
        """
        INSERT INTO subscription_plans (id, name, slug, amount, currency, interval, features, limits, is_active, display_order)
        VALUES (
            '00000000-0000-4000-8000-000000000001',
            'Free', 'free', 0, 'usd', 'month',
            '{"basic_access": true}',
            '{"max_members": 3}',
            true, 0
        )
        """
    )


def downgrade() -> None:
    op.drop_index("ix_webhook_events_stripe_event_id", table_name="webhook_events")
    op.drop_table("webhook_events")
    op.drop_index("ix_subscriptions_plan_id", table_name="subscriptions")
    op.drop_index("ix_subscriptions_team_id", table_name="subscriptions")
    op.drop_table("subscriptions")
    op.drop_index("ix_subscription_plans_slug", table_name="subscription_plans")
    op.drop_table("subscription_plans")
    op.drop_column("teams", "stripe_customer_id")
