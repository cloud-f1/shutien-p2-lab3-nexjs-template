"""Tests for PostgreSQL advisory lock utilities.

Since the test suite uses SQLite (no real advisory lock support),
these tests mock the AsyncSession and verify correct SQL dispatch.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.db.advisory_locks import (
    _string_to_lock_key,
    pg_advisory_lock,
    pg_advisory_unlock,
    pg_try_advisory_lock,
)


def _make_db(scalar_value=None):
    """Create a mock AsyncSession whose execute returns a sync Result mock.

    SQLAlchemy's Result.scalar() is synchronous, so the return value of
    the awaited execute() must be a MagicMock (not AsyncMock).
    """
    db = AsyncMock()
    result = MagicMock()
    result.scalar.return_value = scalar_value
    db.execute.return_value = result
    return db


class TestStringToLockKey:
    def test_consistent(self):
        assert _string_to_lock_key("test") == _string_to_lock_key("test")

    def test_different_strings_different_keys(self):
        assert _string_to_lock_key("a") != _string_to_lock_key("b")

    def test_returns_positive_int(self):
        key = _string_to_lock_key("anything")
        assert isinstance(key, int)
        assert key > 0

    def test_fits_in_pg_bigint(self):
        """PostgreSQL bigint max is 2^63 - 1."""
        key = _string_to_lock_key("large-value-test")
        assert key <= 0x7FFFFFFFFFFFFFFF

    @pytest.mark.parametrize(
        "input_str",
        ["webhook:123", "job:daily-cleanup", "booking:room-42", ""],
    )
    def test_various_strings_produce_valid_keys(self, input_str: str):
        key = _string_to_lock_key(input_str)
        assert isinstance(key, int)
        assert 0 <= key <= 0x7FFFFFFFFFFFFFFF


class TestPgAdvisoryLock:
    async def test_acquires_and_releases(self):
        db = _make_db()
        async with pg_advisory_lock(db, lock_key=42):
            pass
        assert db.execute.call_count == 2

    async def test_releases_on_exception(self):
        db = _make_db()
        with pytest.raises(ValueError, match="boom"):
            async with pg_advisory_lock(db, lock_key=42):
                raise ValueError("boom")
        # unlock must still be called even after exception
        assert db.execute.call_count == 2

    async def test_string_key_converted(self):
        db = _make_db()
        async with pg_advisory_lock(db, lock_key="webhook:123"):
            pass
        assert db.execute.call_count == 2
        # Verify the converted key was used (same for both calls)
        lock_call_key = db.execute.call_args_list[0][0][1]["key"]
        unlock_call_key = db.execute.call_args_list[1][0][1]["key"]
        assert lock_call_key == unlock_call_key
        assert lock_call_key == _string_to_lock_key("webhook:123")

    async def test_integer_key_passed_directly(self):
        db = _make_db()
        async with pg_advisory_lock(db, lock_key=99999):
            pass
        lock_call_key = db.execute.call_args_list[0][0][1]["key"]
        assert lock_call_key == 99999


class TestPgTryAdvisoryLock:
    async def test_returns_scalar_result(self):
        db = _make_db(scalar_value=True)
        result = await pg_try_advisory_lock(db, lock_key=42)
        assert result is True

    async def test_returns_false_when_not_acquired(self):
        db = _make_db(scalar_value=False)
        result = await pg_try_advisory_lock(db, lock_key=42)
        assert result is False

    async def test_string_key_converted(self):
        db = _make_db(scalar_value=True)
        await pg_try_advisory_lock(db, lock_key="job:cleanup")
        call_key = db.execute.call_args[0][1]["key"]
        assert call_key == _string_to_lock_key("job:cleanup")


class TestPgAdvisoryUnlock:
    async def test_returns_scalar_result(self):
        db = _make_db(scalar_value=True)
        result = await pg_advisory_unlock(db, lock_key=42)
        assert result is True

    async def test_string_key_converted(self):
        db = _make_db(scalar_value=True)
        await pg_advisory_unlock(db, lock_key="webhook:456")
        call_key = db.execute.call_args[0][1]["key"]
        assert call_key == _string_to_lock_key("webhook:456")
