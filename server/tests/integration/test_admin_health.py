"""Integration tests for GET /admin/health endpoint."""

import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def _register_and_login(client: AsyncClient, email: str, password: str) -> str:
    """Register a user and return an access token."""
    await client.post(
        "/auth/register",
        json={"email": email, "password": password},
    )
    login_resp = await client.post(
        "/auth/jwt/login",
        data={"username": email, "password": password},
    )
    return login_resp.json()["access_token"]


@pytest.fixture()
async def superuser_token(client: AsyncClient, db: AsyncSession) -> str:
    """Create a superuser and return their access token."""
    email = "admin-health@test.com"
    password = "Admin#Health1"

    # Register normally
    await client.post(
        "/auth/register",
        json={"email": email, "password": password},
    )

    # Promote to superuser via direct DB update
    await db.execute(update(User).where(User.email == email).values(is_superuser=True))
    await db.commit()

    # Login to get a token with superuser claims
    login_resp = await client.post(
        "/auth/jwt/login",
        data={"username": email, "password": password},
    )
    return login_resp.json()["access_token"]


@pytest.fixture()
async def regular_token(client: AsyncClient) -> str:
    """Create a regular (non-superuser) user and return their access token."""
    return await _register_and_login(client, "regular-health@test.com", "Regular#Pass1")


@pytest.mark.integration
class TestAdminHealth:
    """Tests for GET /admin/health."""

    async def test_superuser_gets_200(self, client: AsyncClient, superuser_token: str):
        resp = await client.get(
            "/admin/health",
            headers={"Authorization": f"Bearer {superuser_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()

        # Validate top-level keys
        assert "db" in data
        assert "email" in data
        assert "oauth" in data
        assert "app" in data

        # DB section
        assert data["db"]["status"] in ("connected", "disconnected")
        assert isinstance(data["db"]["latency_ms"], (int, float))
        assert data["db"]["latency_ms"] >= 0

        # Email section
        assert isinstance(data["email"]["provider"], str)
        assert isinstance(data["email"]["configured"], bool)

        # OAuth section
        assert isinstance(data["oauth"]["providers"], list)

        # App section
        assert isinstance(data["app"]["version"], str)
        assert isinstance(data["app"]["uptime_seconds"], (int, float))
        assert data["app"]["uptime_seconds"] >= 0
        assert isinstance(data["app"]["environment"], str)

    async def test_regular_user_gets_403(self, client: AsyncClient, regular_token: str):
        resp = await client.get(
            "/admin/health",
            headers={"Authorization": f"Bearer {regular_token}"},
        )
        assert resp.status_code == 403

    async def test_unauthenticated_gets_401(self, client: AsyncClient):
        resp = await client.get("/admin/health")
        assert resp.status_code == 401

    async def test_db_status_is_connected(self, client: AsyncClient, superuser_token: str):
        """In test environment, DB should always be connected."""
        resp = await client.get(
            "/admin/health",
            headers={"Authorization": f"Bearer {superuser_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["db"]["status"] == "connected"

    async def test_email_provider_defaults_to_console(
        self, client: AsyncClient, superuser_token: str
    ):
        """Default test config uses console email provider."""
        resp = await client.get(
            "/admin/health",
            headers={"Authorization": f"Bearer {superuser_token}"},
        )
        assert resp.status_code == 200
        # In test env, provider could be console or zeabur depending on env config
        assert isinstance(resp.json()["email"]["provider"], str)
        assert isinstance(resp.json()["email"]["configured"], bool)

    async def test_app_version_present(self, client: AsyncClient, superuser_token: str):
        resp = await client.get(
            "/admin/health",
            headers={"Authorization": f"Bearer {superuser_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["app"]["version"] == "1.0.0"
