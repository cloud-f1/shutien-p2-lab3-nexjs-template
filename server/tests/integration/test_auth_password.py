from httpx import AsyncClient


async def test_forgot_password_existing_email(client: AsyncClient):
    await client.post(
        "/auth/register",
        json={
            "email": "forgot@test.com",
            "password": "Secure#Pass1",
        },
    )
    response = await client.post(
        "/auth/forgot-password",
        json={
            "email": "forgot@test.com",
        },
    )
    # fastapi-users always returns 202 for forgot-password
    assert response.status_code == 202


async def test_forgot_password_nonexistent_email(client: AsyncClient):
    response = await client.post(
        "/auth/forgot-password",
        json={
            "email": "nonexistent@test.com",
        },
    )
    # Always 202 — prevents email enumeration
    assert response.status_code == 202


async def test_reset_password_invalid_token(client: AsyncClient):
    response = await client.post(
        "/auth/reset-password",
        json={
            "token": "invalid-token",
            "password": "NewPassword1",
        },
    )
    assert response.status_code == 400
    assert response.json()["error"]["message"] == "RESET_PASSWORD_BAD_TOKEN"
