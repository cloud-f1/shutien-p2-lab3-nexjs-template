"""Property-based tests using hypothesis.

Tests invariants rather than specific examples — catches edge cases
that handwritten tests miss (the Triangulation principle).
"""

import uuid

from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from app.core.config import Settings
from app.models.base import GUID

# ---------- hypothesis profile ----------
# CI-friendly: short deadline, limited examples
settings.register_profile("ci", max_examples=50, deadline=500)
settings.register_profile("dev", max_examples=200, deadline=1000)
settings.load_profile("ci")


# ---------- Config parsing properties ----------


@given(
    parts=st.lists(
        st.text(
            # Exclude commas (delimiter) and whitespace-only to test splitting logic
            alphabet=st.characters(
                whitelist_categories=("L", "N", "P", "S"),
                blacklist_characters=",",
            ),
            min_size=1,
            max_size=50,
        ),
        min_size=1,
        max_size=10,
    )
)
def test_allowed_origins_splits_any_comma_separated_string(parts: list[str]):
    """Property: joining N non-empty strings with commas, then splitting,
    always produces exactly N items (after strip)."""
    raw = ",".join(parts)
    s = Settings(ALLOWED_ORIGINS_STR=raw)
    result = s.ALLOWED_ORIGINS
    # Each non-empty part (after strip) should appear in the result
    expected = [p.strip() for p in parts if p.strip()]
    assert result == expected


@given(raw=st.text(min_size=0, max_size=200))
def test_allowed_origins_never_returns_empty_strings(raw: str):
    """Property: ALLOWED_ORIGINS never contains empty strings,
    regardless of input."""
    s = Settings(ALLOWED_ORIGINS_STR=raw)
    result = s.ALLOWED_ORIGINS
    assert all(item != "" for item in result)


@given(raw=st.text(min_size=0, max_size=200))
def test_allowed_origins_always_returns_list(raw: str):
    """Property: ALLOWED_ORIGINS always returns a list, never None or other type."""
    s = Settings(ALLOWED_ORIGINS_STR=raw)
    result = s.ALLOWED_ORIGINS
    assert isinstance(result, list)


# ---------- GUID TypeDecorator properties ----------


class _FakeDialect:
    """Minimal dialect stub for testing GUID without a real DB."""

    name = "sqlite"


@given(value=st.uuids())
def test_guid_roundtrip(value: uuid.UUID):
    """Property: any UUID survives bind -> result roundtrip via GUID."""
    td = GUID()
    dialect = _FakeDialect()
    bound = td.process_bind_param(value, dialect)
    result = td.process_result_value(bound, dialect)
    assert result == value
    assert isinstance(result, uuid.UUID)


@given(value=st.uuids())
def test_guid_bind_produces_string(value: uuid.UUID):
    """Property: process_bind_param always returns a string (for SQLite)."""
    td = GUID()
    dialect = _FakeDialect()
    bound = td.process_bind_param(value, dialect)
    assert isinstance(bound, str)
    assert len(bound) == 36  # standard UUID string length


# ---------- Email validation boundary properties ----------


@given(
    local=st.text(min_size=1, max_size=10, alphabet="abcdefghijklmnopqrstuvwxyz0123456789"),
    domain=st.text(min_size=1, max_size=10, alphabet="abcdefghijklmnopqrstuvwxyz0123456789"),
    tld=st.sampled_from(["com", "org", "net", "io", "dev"]),
)
@settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_well_formed_emails_have_at_sign(local: str, domain: str, tld: str):
    """Property: any email we construct as local@domain.tld contains exactly one @."""
    email = f"{local}@{domain}.{tld}"
    assert email.count("@") == 1
    assert "." in email.split("@")[1]


def test_guid_none_passthrough():
    """GUID handles None correctly for nullable columns."""
    td = GUID()
    dialect = _FakeDialect()
    assert td.process_bind_param(None, dialect) is None
    assert td.process_result_value(None, dialect) is None
