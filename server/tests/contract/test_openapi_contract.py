"""Contract tests — validate API responses against OpenAPI schema definitions.

Each test makes a real request via the async test client and validates the
response JSON against the schema declared in docs/openapi.yaml.
"""

import pytest

from tests.contract.conftest import assert_matches_schema, get_response_schema


@pytest.mark.contract
class TestHealthContract:
    """GET /health must match HealthResponse schema."""

    async def test_health_matches_schema(self, client, openapi_spec):
        resp = await client.get("/health")
        assert resp.status_code == 200

        schema = get_response_schema(openapi_spec, "/health", "get", "200")
        assert_matches_schema(resp.json(), schema)


@pytest.mark.contract
class TestAuthRegisterContract:
    """POST /auth/register must match UserRead schema on 201."""

    async def test_register_success_matches_schema(self, client, openapi_spec):
        payload = {
            "email": "contract-register@test.com",
            "password": "Contract#Pass1",
        }
        resp = await client.post("/auth/register", json=payload)
        assert resp.status_code == 201

        schema = get_response_schema(openapi_spec, "/auth/register", "post", "201")
        assert_matches_schema(resp.json(), schema)

    async def test_register_duplicate_matches_error_schema(self, client, openapi_spec):
        payload = {
            "email": "contract-dup@test.com",
            "password": "Contract#Pass1",
        }
        # First registration
        await client.post("/auth/register", json=payload)
        # Duplicate — should be 400
        resp = await client.post("/auth/register", json=payload)
        assert resp.status_code == 400

        schema = get_response_schema(openapi_spec, "/auth/register", "post", "400")
        assert_matches_schema(resp.json(), schema)


@pytest.mark.contract
class TestAuthLoginContract:
    """POST /auth/jwt/login must match BearerResponse schema on 200."""

    async def test_login_success_matches_schema(self, client, openapi_spec):
        # Register a user first
        await client.post(
            "/auth/register",
            json={"email": "contract-login@test.com", "password": "Contract#Pass1"},
        )
        # Login with form-data (username field = email)
        resp = await client.post(
            "/auth/jwt/login",
            data={"username": "contract-login@test.com", "password": "Contract#Pass1"},
        )
        assert resp.status_code == 200

        schema = get_response_schema(openapi_spec, "/auth/jwt/login", "post", "200")
        assert_matches_schema(resp.json(), schema)

    async def test_login_bad_credentials_matches_error_schema(self, client, openapi_spec):
        resp = await client.post(
            "/auth/jwt/login",
            data={"username": "nonexistent@test.com", "password": "Wrong#Pass1"},
        )
        assert resp.status_code == 400

        schema = get_response_schema(openapi_spec, "/auth/jwt/login", "post", "400")
        assert_matches_schema(resp.json(), schema)


@pytest.mark.contract
class TestUsersMeContract:
    """GET /users/me must match UserRead schema on 200."""

    async def test_users_me_matches_schema(self, client, openapi_spec):
        # Register + login to get a token
        await client.post(
            "/auth/register",
            json={"email": "contract-me@test.com", "password": "Contract#Pass1"},
        )
        login_resp = await client.post(
            "/auth/jwt/login",
            data={"username": "contract-me@test.com", "password": "Contract#Pass1"},
        )
        token = login_resp.json()["access_token"]

        resp = await client.get(
            "/users/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

        schema = get_response_schema(openapi_spec, "/users/me", "get", "200")
        assert_matches_schema(resp.json(), schema)

    async def test_users_me_unauthorized_matches_error_schema(self, client, openapi_spec):
        resp = await client.get("/users/me")
        assert resp.status_code == 401

        schema = get_response_schema(openapi_spec, "/users/me", "get", "401")
        assert_matches_schema(resp.json(), schema)


@pytest.mark.contract
class TestAdminHealthContract:
    """GET /admin/health must match AdminHealthResponse schema."""

    async def test_admin_health_matches_schema(self, client, db, openapi_spec):
        from sqlalchemy import update

        from app.models.user import User

        await client.post(
            "/auth/register",
            json={
                "email": "contract-admin@test.com",
                "password": "Contract#Admin1",
            },
        )
        await db.execute(
            update(User).where(User.email == "contract-admin@test.com").values(is_superuser=True)
        )
        await db.commit()

        login_resp = await client.post(
            "/auth/jwt/login",
            data={
                "username": "contract-admin@test.com",
                "password": "Contract#Admin1",
            },
        )
        token = login_resp.json()["access_token"]

        resp = await client.get(
            "/admin/health",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

        schema = get_response_schema(openapi_spec, "/admin/health", "get", "200")
        assert_matches_schema(resp.json(), schema)
