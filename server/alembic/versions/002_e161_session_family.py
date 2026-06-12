"""E161 — extend sessions table with rotation family columns

Revision ID: 002
Revises: 001
Create Date: 2026-04-24

Adds the columns required for refresh-token reuse detection:

  * ``family_id``    — UUID grouping every session descended from one login.
                      On reuse we revoke the entire family in one statement.
  * ``parent_hash``  — pointer to the prior token hash in the rotation chain
                      (NULL for the first session in a family).
  * ``revoked_at``   — precise revocation timestamp, indexed for cleanup jobs.
                      Coexists with the legacy ``is_revoked`` boolean.
  * ``user_agent``   — raw User-Agent header (the existing ``device_info``
                      column is kept and populated identically for back-compat).

Backfill: pre-existing rows get ``family_id = id`` (one-row family per legacy
session). ``parent_hash`` and ``revoked_at`` start NULL.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add the new columns as NULLABLE so we can backfill safely.
    op.add_column("sessions", sa.Column("family_id", sa.Uuid(), nullable=True))
    op.add_column("sessions", sa.Column("parent_hash", sa.String(64), nullable=True))
    op.add_column("sessions", sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("sessions", sa.Column("user_agent", sa.String(512), nullable=True))

    # 2. Backfill ``family_id`` from the existing primary key — every legacy
    #    row becomes a one-row family. This is a no-op on a fresh schema.
    op.execute("UPDATE sessions SET family_id = id WHERE family_id IS NULL")

    # 3. Tighten ``family_id`` to NOT NULL now that backfill is complete.
    with op.batch_alter_table("sessions") as batch:
        batch.alter_column("family_id", existing_type=sa.Uuid(), nullable=False)

    # 4. Indexes for the lookup paths we use:
    #    - family_id → revoke-all-in-family on reuse detection
    #    - revoked_at → background job that purges old revoked rows
    op.create_index("ix_sessions_family_id", "sessions", ["family_id"])
    op.create_index("ix_sessions_revoked_at", "sessions", ["revoked_at"])


def downgrade() -> None:
    op.drop_index("ix_sessions_revoked_at", table_name="sessions")
    op.drop_index("ix_sessions_family_id", table_name="sessions")
    op.drop_column("sessions", "user_agent")
    op.drop_column("sessions", "revoked_at")
    op.drop_column("sessions", "parent_hash")
    op.drop_column("sessions", "family_id")
