import pytest
from httpx import AsyncClient


async def _register(client: AsyncClient, email: str, password: str = "Secure#Pass1"):
    await client.post("/auth/register", json={"email": email, "password": password})


async def test_login_success(client: AsyncClient):
    await _register(client, "login@test.com")
    response = await client.post(
        "/auth/jwt/login",
        data={"username": "login@test.com", "password": "Secure#Pass1"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.parametrize(
    "email, password, register_first, expected_detail",
    [
        pytest.param(
            "wrongpw@test.com",
            "WrongPassword1",
            True,
            "LOGIN_BAD_CREDENTIALS",
            id="wrong_password",
        ),
        pytest.param(
            "nobody@test.com",
            "Secure#Pass1",
            False,
            "LOGIN_BAD_CREDENTIALS",
            id="nonexistent_user",
        ),
    ],
)
async def test_login_failure(client: AsyncClient, email, password, register_first, expected_detail):
    if register_first:
        await _register(client, email)
    response = await client.post(
        "/auth/jwt/login",
        data={"username": email, "password": password},
    )
    assert response.status_code == 400
    assert response.json()["error"]["message"] == expected_detail
