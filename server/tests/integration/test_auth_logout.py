from httpx import AsyncClient


async def _login(client: AsyncClient, email: str, password: str = "Secure#Pass1") -> str:
    await client.post("/auth/register", json={"email": email, "password": password})
    resp = await client.post(
        "/auth/jwt/login",
        data={"username": email, "password": password},
    )
    return resp.json()["access_token"]


async def test_logout_success(client: AsyncClient):
    token = await _login(client, "logout@test.com")
    response = await client.post(
        "/auth/jwt/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 204


async def test_logout_without_auth(client: AsyncClient):
    response = await client.post("/auth/jwt/logout")
    assert response.status_code == 401
