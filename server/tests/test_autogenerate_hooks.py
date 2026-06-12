"""Tests for E63 — Alembic autogenerate hooks (render_item + compare_type).

Validates that env.py hooks normalize UUID types and prevent spurious ALTERs.
"""

from pathlib import Path

import sqlalchemy as sa

from app.core.alembic_hooks import _is_uuid_like, render_item, compare_type
from app.models.base import GUID

try:
    from sqlalchemy.dialects.postgresql import UUID as PG_UUID
except ImportError:
    PG_UUID = None


# ---------------------------------------------------------------------------
# _is_uuid_like
# ---------------------------------------------------------------------------


class TestIsUuidLike:
    def test_guid_is_uuid_like(self):
        assert _is_uuid_like(GUID()) is True

    def test_sa_uuid_is_uuid_like(self):
        assert _is_uuid_like(sa.Uuid()) is True

    def test_pg_uuid_is_uuid_like(self):
        if PG_UUID is not None:
            assert _is_uuid_like(PG_UUID()) is True

    def test_char36_is_uuid_like(self):
        assert _is_uuid_like(sa.CHAR(36)) is True

    def test_char32_is_uuid_like(self):
        # CHAR(32) is how SQLite reflects sa.Uuid() columns
        assert _is_uuid_like(sa.CHAR(32)) is True

    def test_string_is_not_uuid_like(self):
        assert _is_uuid_like(sa.String(100)) is False

    def test_integer_is_not_uuid_like(self):
        assert _is_uuid_like(sa.Integer()) is False

    def test_boolean_is_not_uuid_like(self):
        assert _is_uuid_like(sa.Boolean()) is False


# ---------------------------------------------------------------------------
# render_item
# ---------------------------------------------------------------------------


class TestRenderItem:
    def test_guid_renders_as_sa_uuid(self):
        result = render_item("type", GUID(), None)
        assert result == "sa.Uuid()"

    def test_sa_uuid_renders_as_sa_uuid(self):
        result = render_item("type", sa.Uuid(), None)
        assert result == "sa.Uuid()"

    def test_char36_renders_as_sa_uuid(self):
        result = render_item("type", sa.CHAR(36), None)
        assert result == "sa.Uuid()"

    def test_pg_uuid_renders_as_sa_uuid(self):
        if PG_UUID is not None:
            result = render_item("type", PG_UUID(), None)
            assert result == "sa.Uuid()"

    def test_non_uuid_type_returns_false(self):
        """Non-UUID types should return False (let Alembic handle)."""
        result = render_item("type", sa.String(100), None)
        assert result is False

    def test_non_type_render_returns_false(self):
        """Non-'type' render items should return False."""
        result = render_item("server_default", sa.Uuid(), None)
        assert result is False


# ---------------------------------------------------------------------------
# compare_type
# ---------------------------------------------------------------------------


class TestCompareType:
    def _make_col(self, type_: sa.types.TypeEngine) -> sa.Column:
        return sa.Column("test", type_)

    def test_guid_vs_uuid_are_equivalent(self):
        """GUID and sa.Uuid should be treated as equivalent (no ALTER)."""
        result = compare_type(
            None,
            self._make_col(sa.Uuid()),
            self._make_col(GUID()),
            sa.Uuid(),
            GUID(),
        )
        assert result is False

    def test_guid_vs_char36_are_equivalent(self):
        """GUID and CHAR(36) are both UUID-like (no ALTER)."""
        result = compare_type(
            None,
            self._make_col(sa.CHAR(36)),
            self._make_col(GUID()),
            sa.CHAR(36),
            GUID(),
        )
        assert result is False

    def test_uuid_vs_string100_differ(self):
        """UUID-like vs non-UUID should trigger ALTER."""
        result = compare_type(
            None,
            self._make_col(sa.Uuid()),
            self._make_col(sa.String(100)),
            sa.Uuid(),
            sa.String(100),
        )
        assert result is True

    def test_string_vs_guid_differ(self):
        """Non-UUID inspected vs GUID model should trigger ALTER."""
        result = compare_type(
            None,
            self._make_col(sa.String(100)),
            self._make_col(GUID()),
            sa.String(100),
            GUID(),
        )
        assert result is True

    def test_unrelated_types_deferred(self):
        """Two non-UUID types should return None (let Alembic decide)."""
        result = compare_type(
            None,
            self._make_col(sa.String(100)),
            self._make_col(sa.Integer()),
            sa.String(100),
            sa.Integer(),
        )
        assert result is None


# ---------------------------------------------------------------------------
# Migration template
# ---------------------------------------------------------------------------


class TestMigrationTemplate:
    def test_template_has_uuid_pattern_comment(self):
        template = Path(__file__).parent.parent / "alembic" / "script.py.mako"
        content = template.read_text()
        assert "sa.Uuid()" in content

    def test_template_has_boolean_default_comment(self):
        template = Path(__file__).parent.parent / "alembic" / "script.py.mako"
        content = template.read_text()
        assert "sa.text" in content

    def test_template_has_ondelete_comment(self):
        template = Path(__file__).parent.parent / "alembic" / "script.py.mako"
        content = template.read_text()
        assert "ondelete" in content
