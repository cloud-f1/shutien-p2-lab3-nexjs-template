import os

# Mark as test environment BEFORE any app imports (disables placeholder validation)
os.environ.setdefault("TESTING", "1")

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # noqa: F401 — register all models for metadata
from app.core.limiter import limiter
from app.db.session import get_db
from app.main import app as fastapi_app
from app.models.base import Base

# Disable rate limiting in tests
limiter.enabled = False

TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "sqlite+aiosqlite:///./test.db",
)


@pytest.fixture(scope="session")
async def engine():
    _engine = create_async_engine(TEST_DB_URL, echo=False)
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield _engine
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await _engine.dispose()


@pytest.fixture()
async def db(engine) -> AsyncSession:
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
        await session.rollback()


@pytest.fixture()
async def client(db) -> AsyncClient:
    from fastapi_users.db import SQLAlchemyUserDatabase

    from app.models.user import OAuthAccount, User
    from app.services.user_manager import UserManager

    async def _get_db():
        yield db

    async def _get_user_db():
        yield SQLAlchemyUserDatabase(db, User, OAuthAccount)

    async def _get_user_manager():
        user_db = SQLAlchemyUserDatabase(db, User, OAuthAccount)
        yield UserManager(user_db)

    fastapi_app.dependency_overrides[get_db] = _get_db

    from app.db.session import get_user_db
    from app.services.user_manager import get_user_manager

    fastapi_app.dependency_overrides[get_user_db] = _get_user_db
    fastapi_app.dependency_overrides[get_user_manager] = _get_user_manager

    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as c:
        yield c
    fastapi_app.dependency_overrides.clear()


@pytest.fixture()
def api_schema(client):  # noqa: ARG001 — client is required for dependency overrides to be wired
    """Schemathesis OpenAPI schema loaded from the live ASGI app.

    Used by ``tests/contract/test_schemathesis_conformance.py`` (E156) to
    sweep every operation × status against ``docs/openapi.yaml`` without
    going over the network. The ``client`` dependency guarantees test DB +
    user-manager overrides are wired before the schema is loaded.
    """
    import schemathesis

    return schemathesis.openapi.from_asgi("/openapi.json", fastapi_app)
