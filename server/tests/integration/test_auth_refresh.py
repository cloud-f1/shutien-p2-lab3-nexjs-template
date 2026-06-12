from httpx import AsyncClient


async def _register_and_login(
    client: AsyncClient, email: str, password: str = "Secure#Pass1"
) -> dict:
    await client.post("/auth/register", json={"email": email, "password": password})
    resp = await client.post(
        "/auth/jwt/login",
        data={"username": email, "password": password},
    )
    return resp.json()


async def test_login_returns_refresh_token(client: AsyncClient):
    data = await _register_and_login(client, "refresh1@test.com")
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


async def test_refresh_returns_new_token_pair(client: AsyncClient):
    data = await _register_and_login(client, "refresh2@test.com")
    refresh_token = data["refresh_token"]

    resp = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    new_data = resp.json()
    assert "access_token" in new_data
    assert "refresh_token" in new_data
    assert new_data["refresh_token"] != refresh_token  # rotated


async def test_refresh_with_invalid_token(client: AsyncClient):
    resp = await client.post("/auth/refresh", json={"refresh_token": "garbage"})
    assert resp.status_code == 401
    assert resp.json()["error"]["message"] == "INVALID_REFRESH_TOKEN"


async def test_refresh_new_access_token_works(client: AsyncClient):
    data = await _register_and_login(client, "refresh3@test.com")

    resp = await client.post("/auth/refresh", json={"refresh_token": data["refresh_token"]})
    new_access = resp.json()["access_token"]

    me = await client.get("/users/me", headers={"Authorization": f"Bearer {new_access}"})
    assert me.status_code == 200
    assert me.json()["email"] == "refresh3@test.com"
