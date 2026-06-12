"""PostgreSQL migration smoke test — requires a running test-db.

Runs the full Alembic migration chain (upgrade → downgrade → upgrade)
against a real PostgreSQL instance to catch SQLite-invisible bugs.

Usage:
    make test-migrations   # starts test-db, runs this, stops test-db

Skipped automatically when TEST_DATABASE_URL is not set to PostgreSQL.
"""

import os

os.environ.setdefault("TESTING", "1")

import pytest
from alembic import command
from alembic.config import Config

ALEMBIC_INI = os.path.join(os.path.dirname(__file__), "..", "alembic.ini")

_PG_URL = os.environ.get("TEST_DATABASE_URL", "")
_HAS_PG = _PG_URL.startswith("postgresql")

pytestmark = pytest.mark.skipif(not _HAS_PG, reason="TEST_DATABASE_URL not set to PostgreSQL")


def _alembic_cfg() -> Config:
    """Create an Alembic config pointing at the test PostgreSQL database."""
    cfg = Config(ALEMBIC_INI)
    # Alembic's sync runner needs psycopg2-compatible URL, not asyncpg
    sync_url = _PG_URL.replace("+asyncpg", "")
    cfg.set_main_option("sqlalchemy.url", sync_url)
    return cfg


class TestMigrationSmoke:
    """Full migration round-trip against PostgreSQL."""

    def test_upgrade_head(self):
        """All migrations apply cleanly to a fresh PostgreSQL database."""
        cfg = _alembic_cfg()
        command.upgrade(cfg, "head")

    def test_downgrade_base(self):
        """All downgrades complete without errors."""
        cfg = _alembic_cfg()
        # Ensure we're at head first
        command.upgrade(cfg, "head")
        command.downgrade(cfg, "base")

    def test_upgrade_idempotency(self):
        """Upgrade → downgrade → upgrade succeeds (idempotency check)."""
        cfg = _alembic_cfg()
        command.upgrade(cfg, "head")
        command.downgrade(cfg, "base")
        command.upgrade(cfg, "head")
