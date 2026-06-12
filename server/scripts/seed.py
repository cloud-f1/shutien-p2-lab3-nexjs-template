"""Seed script — creates test users for local development.

Usage:
    cd server && python -m scripts.seed

Creates:
    - admin@test.com    (superuser, verified)
    - user@test.com     (regular user, verified)
    - unverified@test.com (regular user, not verified)
"""

import asyncio
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.base import Base
from app.models.user import OAuthAccount, User  # noqa: F401 — register models


async def seed():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)

    # Create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with factory() as db:
        # Check if already seeded
        result = await db.execute(text('SELECT count(*) FROM "user"'))
        count = result.scalar()
        if count and count > 0:
            print(f"Database already has {count} users. Skipping seed.")
            await engine.dispose()
            return

        users = await create_seed_users(db)

        for u in users:
            print(f"  Created: {u['email']:30s} role={u['role']:12s} verified={u['verified']}")

    await engine.dispose()
    print(f"\nSeeded {len(users)} users into {settings.DATABASE_URL}")


async def create_seed_users(db: AsyncSession) -> list[dict]:
    """Create test users. Returns metadata about created users."""
    from fastapi_users.password import PasswordHelper

    ph = PasswordHelper()
    users_data = [
        {
            "email": "admin@test.com",
            "password": "Admin#Pass1",
            "display_name": "Admin User",
            "is_superuser": True,
            "is_verified": True,
            "role": "superuser",
            "verified": True,
        },
        {
            "email": "user@test.com",
            "password": "User#Pass1",
            "display_name": "Regular User",
            "is_superuser": False,
            "is_verified": True,
            "role": "user",
            "verified": True,
        },
        {
            "email": "unverified@test.com",
            "password": "Unverified#1",
            "display_name": "Unverified User",
            "is_superuser": False,
            "is_verified": False,
            "role": "user",
            "verified": False,
        },
    ]

    for data in users_data:
        user = User(
            id=uuid.uuid4(),
            email=data["email"],
            hashed_password=ph.hash(data["password"]),
            display_name=data["display_name"],
            is_active=True,
            is_superuser=data["is_superuser"],
            is_verified=data["is_verified"],
        )
        db.add(user)

    await db.commit()
    return users_data


if __name__ == "__main__":
    asyncio.run(seed())
