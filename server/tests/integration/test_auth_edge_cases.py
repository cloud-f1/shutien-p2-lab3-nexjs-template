import pytest
from httpx import AsyncClient


@pytest.mark.parametrize(
    "token_value",
    [
        pytest.param("not-a-jwt", id="garbage_string"),
        pytest.param("eyJhbGciOiJIUzI1NiJ9.invalid.payload", id="malformed_jwt"),
        pytest.param("", id="empty_token"),
    ],
)
async def test_invalid_bearer_format(client: AsyncClient, token_value):
    response = await client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {token_value}"},
    )
    assert response.status_code == 401


@pytest.mark.parametrize(
    "email",
    [
        pytest.param("not-an-email", id="no_at_sign"),
        pytest.param("@missing-local.com", id="missing_local_part"),
        pytest.param("spaces in@email.com", id="spaces_in_local"),
        pytest.param("user@", id="missing_domain"),
    ],
)
async def test_register_invalid_email(client: AsyncClient, email):
    response = await client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "Secure#Pass1",
        },
    )
    assert response.status_code == 422


async def test_login_empty_body(client: AsyncClient):
    response = await client.post("/auth/jwt/login", data={})
    assert response.status_code == 422


async def test_get_me_unauthorized(client: AsyncClient):
    response = await client.get("/users/me")
    assert response.status_code == 401


async def test_update_me_validates_display_name_length(client: AsyncClient):
    await client.post(
        "/auth/register",
        json={
            "email": "longname@test.com",
            "password": "Secure#Pass1",
        },
    )
    # Login to get JWT
    login = await client.post(
        "/auth/jwt/login",
        data={"username": "longname@test.com", "password": "Secure#Pass1"},
    )
    token = login.json()["access_token"]
    response = await client.patch(
        "/users/me",
        json={"display_name": "A" * 101},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422
