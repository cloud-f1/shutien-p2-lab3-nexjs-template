from httpx import AsyncClient


async def _get_auth_headers(client: AsyncClient, email: str = "user@test.com") -> dict:
    await client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "Secure#Pass1",
            "display_name": "Test User",
        },
    )
    login = await client.post(
        "/auth/jwt/login",
        data={"username": email, "password": "Secure#Pass1"},
    )
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def test_get_me(client: AsyncClient):
    headers = await _get_auth_headers(client, "me@test.com")
    response = await client.get("/users/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["email"] == "me@test.com"
    assert response.json()["display_name"] == "Test User"


async def test_get_me_unauthorized(client: AsyncClient):
    response = await client.get("/users/me")
    assert response.status_code == 401


async def test_update_me(client: AsyncClient):
    headers = await _get_auth_headers(client, "update@test.com")
    response = await client.patch(
        "/users/me",
        json={"display_name": "Updated Name"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["display_name"] == "Updated Name"


async def test_delete_me(client: AsyncClient):
    headers = await _get_auth_headers(client, "delete@test.com")
    # Verify user exists first
    response = await client.get("/users/me", headers=headers)
    assert response.status_code == 200

    # Delete account
    response = await client.delete("/users/me", headers=headers)
    assert response.status_code == 204

    # Verify user no longer exists — subsequent requests should fail
    response = await client.get("/users/me", headers=headers)
    assert response.status_code == 401


async def test_delete_me_unauthorized(client: AsyncClient):
    response = await client.delete("/users/me")
    assert response.status_code == 401
