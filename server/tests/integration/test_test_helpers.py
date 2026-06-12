"""Integration tests for test-helper endpoints (E150).

Verifies the triple-guard pattern:
  Gate 1: ENABLE_TEST_HELPERS env var must be true  → 404
  Gate 2: ENVIRONMENT must not be "production"      → 403
  Gate 3: JWT authentication required               → 401
Plus seed idempotency and reset behavior.
"""

from unittest.mock import patch

import pytest
from httpx import AsyncClient


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
async def auth_token(client: AsyncClient) -> str:
    """Create a regular user and return their access token."""
    return await _register_and_login(client, "helper-caller@test.com", "Caller#Pass1")


@pytest.mark.integration
class TestGate1DisabledFlag:
    """Gate 1: ENABLE_TEST_HELPERS=false → 404."""

    async def test_seed_returns_404_when_disabled(self, client: AsyncClient, auth_token: str):
        with patch("app.api.v1.endpoints.test_helpers.settings") as mock_settings:
            mock_settings.ENABLE_TEST_HELPERS = False
            mock_settings.ENVIRONMENT = "development"
            resp = await client.post(
                "/api/v1/test-helpers/seed",
                json={"email": "seed@test.com", "password": "Seed#Pass1"},
                headers={"Authorization": f"Bearer {auth_token}"},
            )
        assert resp.status_code == 404

    async def test_reset_returns_404_when_disabled(self, client: AsyncClient, auth_token: str):
        with patch("app.api.v1.endpoints.test_helpers.settings") as mock_settings:
            mock_settings.ENABLE_TEST_HELPERS = False
            mock_settings.ENVIRONMENT = "development"
            resp = await client.post(
                "/api/v1/test-helpers/reset",
                json={"email": "seed@test.com"},
                headers={"Authorization": f"Bearer {auth_token}"},
            )
        assert resp.status_code == 404


@pytest.mark.integration
class TestGate2ProductionBlock:
    """Gate 2: ENVIRONMENT=production → 403."""

    async def test_seed_returns_403_in_production(self, client: AsyncClient, auth_token: str):
        with patch("app.api.v1.endpoints.test_helpers.settings") as mock_settings:
            mock_settings.ENABLE_TEST_HELPERS = True
            mock_settings.ENVIRONMENT = "production"
            resp = await client.post(
                "/api/v1/test-helpers/seed",
                json={"email": "seed@test.com", "password": "Seed#Pass1"},
                headers={"Authorization": f"Bearer {auth_token}"},
            )
        assert resp.status_code == 403
        assert resp.json()["error"]["code"] == "TEST_HELPERS_BLOCKED"

    async def test_reset_returns_403_in_production(self, client: AsyncClient, auth_token: str):
        with patch("app.api.v1.endpoints.test_helpers.settings") as mock_settings:
            mock_settings.ENABLE_TEST_HELPERS = True
            mock_settings.ENVIRONMENT = "production"
            resp = await client.post(
                "/api/v1/test-helpers/reset",
                json={"email": "seed@test.com"},
                headers={"Authorization": f"Bearer {auth_token}"},
            )
        assert resp.status_code == 403


@pytest.mark.integration
class TestGate3Authentication:
    """Gate 3: No JWT → 401."""

    async def test_seed_returns_401_without_token(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/test-helpers/seed",
            json={"email": "seed@test.com", "password": "Seed#Pass1"},
        )
        assert resp.status_code == 401

    async def test_reset_returns_401_without_token(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/test-helpers/reset",
            json={"email": "seed@test.com"},
        )
        assert resp.status_code == 401


@pytest.mark.integration
class TestSeedBehavior:
    """Seed endpoint — create + idempotency."""

    async def test_seed_creates_new_user(self, client: AsyncClient, auth_token: str):
        with patch("app.api.v1.endpoints.test_helpers.settings") as mock_settings:
            mock_settings.ENABLE_TEST_HELPERS = True
            mock_settings.ENVIRONMENT = "development"
            resp = await client.post(
                "/api/v1/test-helpers/seed",
                json={
                    "email": "new-seed@test.com",
                    "password": "Seed#Pass1",
                    "is_superuser": False,
                },
                headers={"Authorization": f"Bearer {auth_token}"},
            )
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "new-seed@test.com"
        assert data["created"] is True
        assert data["is_superuser"] is False

    async def test_seed_is_idempotent(self, client: AsyncClient, auth_token: str):
        email = "idempotent-seed@test.com"
        with patch("app.api.v1.endpoints.test_helpers.settings") as mock_settings:
            mock_settings.ENABLE_TEST_HELPERS = True
            mock_settings.ENVIRONMENT = "development"
            # First call — creates
            resp1 = await client.post(
                "/api/v1/test-helpers/seed",
                json={"email": email, "password": "Seed#Pass1"},
                headers={"Authorization": f"Bearer {auth_token}"},
            )
            assert resp1.status_code == 201
            assert resp1.json()["created"] is True

            # Second call — returns existing
            resp2 = await client.post(
                "/api/v1/test-helpers/seed",
                json={"email": email, "password": "Seed#Pass1"},
                headers={"Authorization": f"Bearer {auth_token}"},
            )
        assert resp2.status_code == 200
        assert resp2.json()["created"] is False
        assert resp2.json()["id"] == resp1.json()["id"]

    async def test_seed_superuser(self, client: AsyncClient, auth_token: str):
        with patch("app.api.v1.endpoints.test_helpers.settings") as mock_settings:
            mock_settings.ENABLE_TEST_HELPERS = True
            mock_settings.ENVIRONMENT = "development"
            resp = await client.post(
                "/api/v1/test-helpers/seed",
                json={
                    "email": "super-seed@test.com",
                    "password": "Seed#Pass1",
                    "is_superuser": True,
                },
                headers={"Authorization": f"Bearer {auth_token}"},
            )
        assert resp.status_code == 201
        assert resp.json()["is_superuser"] is True


@pytest.mark.integration
class TestResetBehavior:
    """Reset endpoint — delete + idempotency."""

    async def test_reset_deletes_seeded_user(self, client: AsyncClient, auth_token: str):
        email = "reset-target@test.com"
        with patch("app.api.v1.endpoints.test_helpers.settings") as mock_settings:
            mock_settings.ENABLE_TEST_HELPERS = True
            mock_settings.ENVIRONMENT = "development"
            # Seed first
            await client.post(
                "/api/v1/test-helpers/seed",
                json={"email": email, "password": "Seed#Pass1"},
                headers={"Authorization": f"Bearer {auth_token}"},
            )
            # Reset
            resp = await client.post(
                "/api/v1/test-helpers/reset",
                json={"email": email},
                headers={"Authorization": f"Bearer {auth_token}"},
            )
        assert resp.status_code == 204

    async def test_reset_nonexistent_user_returns_204(self, client: AsyncClient, auth_token: str):
        with patch("app.api.v1.endpoints.test_helpers.settings") as mock_settings:
            mock_settings.ENABLE_TEST_HELPERS = True
            mock_settings.ENVIRONMENT = "development"
            resp = await client.post(
                "/api/v1/test-helpers/reset",
                json={"email": "never-existed@test.com"},
                headers={"Authorization": f"Bearer {auth_token}"},
            )
        assert resp.status_code == 204
