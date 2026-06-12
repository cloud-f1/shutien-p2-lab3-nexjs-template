from httpx import AsyncClient


async def test_verify_email_invalid_token(client: AsyncClient):
    response = await client.post("/auth/verify", json={"token": "invalid-token"})
    assert response.status_code == 400
    assert response.json()["error"]["message"] == "VERIFY_USER_BAD_TOKEN"


async def test_request_verify_token(client: AsyncClient):
    await client.post(
        "/auth/register",
        json={
            "email": "verify-req@test.com",
            "password": "Secure#Pass1",
        },
    )
    # Login to get token
    login = await client.post(
        "/auth/jwt/login",
        data={"username": "verify-req@test.com", "password": "Secure#Pass1"},
    )
    token = login.json()["access_token"]

    response = await client.post(
        "/auth/request-verify-token",
        json={"email": "verify-req@test.com"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 202
