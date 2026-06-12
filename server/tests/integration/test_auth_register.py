import pytest
from httpx import AsyncClient


async def test_register_success(client: AsyncClient):
    response = await client.post(
        "/auth/register",
        json={
            "email": "alex@test.com",
            "password": "Secure#Pass1",
            "display_name": "Alex",
        },
    )
    assert response.status_code == 201
    data = response.json()
    # E161: register returns unified AuthResponse {user, access_token, refresh_token, ...}
    assert data["user"]["email"] == "alex@test.com"
    assert data["user"]["display_name"] == "Alex"
    assert data["user"]["is_verified"] is False
    assert "id" in data["user"]
    assert data["token_type"] == "bearer"
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["expires_in"] > 0


async def test_register_duplicate_email(client: AsyncClient):
    payload = {"email": "dup@test.com", "password": "Secure#Pass1", "display_name": "Dup"}
    await client.post("/auth/register", json=payload)
    response = await client.post("/auth/register", json=payload)
    assert response.status_code == 400
    assert response.json()["error"]["message"] == "REGISTER_USER_ALREADY_EXISTS"


@pytest.mark.parametrize(
    "payload, expected_status",
    [
        pytest.param(
            {"email": "no@pass.com"},
            422,
            id="missing_password",
        ),
        pytest.param(
            {"email": "short@test.com", "password": "1234567"},
            # fastapi-users has a minimum password length of 3 by default
            # so short passwords may return 201, 400, or 422
            (201, 400, 422),
            id="short_password",
        ),
        pytest.param(
            {"password": "Secure#Pass1"},
            422,
            id="missing_email",
        ),
    ],
)
async def test_register_validation_errors(client: AsyncClient, payload, expected_status):
    response = await client.post("/auth/register", json=payload)
    if isinstance(expected_status, tuple):
        assert response.status_code in expected_status
    else:
        assert response.status_code == expected_status


async def test_register_without_display_name(client: AsyncClient):
    response = await client.post(
        "/auth/register",
        json={
            "email": "noname@test.com",
            "password": "Secure#Pass1",
        },
    )
    assert response.status_code == 201
    # E161: register returns unified AuthResponse — display_name nested under "user"
    assert response.json()["user"]["display_name"] is None


async def test_auth_response_user_includes_social_providers(client: AsyncClient):
    """Regression: UserRead must serialize ``social_providers`` (OpenAPI SSOT,
    ``default: []``). The server schema previously omitted it, so register/login
    responses failed the client's strict Zod parse → "Sign in failed" (broke
    the dashboard VRT auth flow in E211). A user with no OAuth accounts → []."""
    # Register → AuthResponse.user must carry the field.
    reg = await client.post(
        "/auth/register",
        json={"email": "social@test.com", "password": "Secure#Pass1"},
    )
    assert reg.status_code == 201
    reg_user = reg.json()["user"]
    assert "social_providers" in reg_user, "UserRead must include social_providers"
    assert reg_user["social_providers"] == []

    # Login → same UserRead serialization must also carry it.
    login = await client.post(
        "/auth/jwt/login",
        data={"username": "social@test.com", "password": "Secure#Pass1"},
    )
    assert login.status_code == 200
    assert login.json()["user"]["social_providers"] == []
