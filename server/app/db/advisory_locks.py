"""PostgreSQL advisory lock utilities.

Advisory locks are application-level locks that don't block regular table operations.
They're useful for ensuring exclusive access to critical sections like:
- Webhook deduplication
- Scheduled job execution
- Resource booking/reservation

Usage:
    async with pg_advisory_lock(db, lock_key=12345):
        # Only one process can be here at a time for this key
        await process_webhook(webhook_id)

    # Non-blocking variant
    acquired = await pg_try_advisory_lock(db, lock_key=12345)
    if acquired:
        try:
            await process_something()
        finally:
            await pg_advisory_unlock(db, lock_key=12345)
"""

import hashlib
from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _string_to_lock_key(s: str) -> int:
    """Convert a string to a 64-bit integer for use as a lock key.

    Uses SHA-256 and masks to fit PostgreSQL's bigint range (positive only).
    """
    return int(hashlib.sha256(s.encode()).hexdigest()[:16], 16) & 0x7FFFFFFFFFFFFFFF


@asynccontextmanager
async def pg_advisory_lock(db: AsyncSession, lock_key: int | str) -> AsyncIterator[None]:
    """Acquire a PostgreSQL session-level advisory lock (blocking).

    Args:
        db: SQLAlchemy async session.
        lock_key: Integer key or string (hashed to int).

    Yields:
        None — the lock is held for the duration of the context.
    """
    key = lock_key if isinstance(lock_key, int) else _string_to_lock_key(lock_key)
    await db.execute(text("SELECT pg_advisory_lock(:key)"), {"key": key})
    try:
        yield
    finally:
        await db.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": key})


async def pg_try_advisory_lock(db: AsyncSession, lock_key: int | str) -> bool:
    """Try to acquire an advisory lock without blocking.

    Returns:
        True if the lock was successfully acquired, False otherwise.
    """
    key = lock_key if isinstance(lock_key, int) else _string_to_lock_key(lock_key)
    result = await db.execute(text("SELECT pg_try_advisory_lock(:key)"), {"key": key})
    return result.scalar()


async def pg_advisory_unlock(db: AsyncSession, lock_key: int | str) -> bool:
    """Release an advisory lock.

    Returns:
        True if the lock was held and successfully released.
    """
    key = lock_key if isinstance(lock_key, int) else _string_to_lock_key(lock_key)
    result = await db.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": key})
    return result.scalar()
