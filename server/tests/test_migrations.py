"""Migration structure and round-trip tests.

- test_single_head / test_revision_chain: always run (no DB needed)
- test_migration_round_trip: requires PostgreSQL (skipped if not available)
"""

import os

os.environ.setdefault("TESTING", "1")

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory

ALEMBIC_INI = os.path.join(os.path.dirname(__file__), "..", "alembic.ini")

_PG_URL = os.environ.get("TEST_DATABASE_URL", "")
_HAS_PG = _PG_URL.startswith("postgresql")


def test_single_head():
    """Ensure there is exactly one head revision (no branch conflicts)."""
    script = ScriptDirectory.from_config(Config(ALEMBIC_INI))
    heads = script.get_heads()
    assert len(heads) == 1, f"Expected 1 head, got {len(heads)}: {heads}"


def test_revision_chain_contiguous():
    """All revisions form a single linear chain with no gaps."""
    script = ScriptDirectory.from_config(Config(ALEMBIC_INI))
    revisions = list(script.walk_revisions())
    # Walk returns head→base order. Check each points to the next.
    for i, rev in enumerate(revisions[:-1]):
        next_rev = revisions[i + 1]
        assert rev.down_revision == next_rev.revision, (
            f"Broken chain: {rev.revision} → down_revision={rev.down_revision}, "
            f"expected {next_rev.revision}"
        )
    # Last revision should have no down_revision (it's the base)
    assert revisions[-1].down_revision is None, (
        f"Base revision {revisions[-1].revision} has unexpected down_revision: "
        f"{revisions[-1].down_revision}"
    )


@pytest.mark.skipif(not _HAS_PG, reason="TEST_DATABASE_URL not set to PostgreSQL")
def test_migration_round_trip():
    """Upgrade → downgrade → upgrade against real PostgreSQL."""
    from alembic import command

    cfg = Config(ALEMBIC_INI)
    cfg.set_main_option("sqlalchemy.url", _PG_URL.replace("+asyncpg", ""))
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
