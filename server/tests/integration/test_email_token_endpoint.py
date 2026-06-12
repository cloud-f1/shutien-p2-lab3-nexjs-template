"""Test the dev-only email token extraction endpoint."""

from httpx import AsyncClient


async def test_last_email_token_returns_token_after_register(client: AsyncClient):
    """Register triggers verification email → token is extractable."""
    # Register a user (triggers send_verification_email)
    await client.post(
        "/auth/register",
        json={"email": "token-test@test.com", "password": "Secure#Pass1"},
    )

    # Extract the token via dev endpoint
    resp = await client.get("/auth/test/last-email-token")
    assert resp.status_code == 200
    data = resp.json()
    assert data["token"] is not None
    assert data["email"] == "token-test@test.com"


async def test_last_email_token_cleared_after_read(client: AsyncClient):
    """Token is one-shot — cleared after first read."""
    await client.post(
        "/auth/register",
        json={"email": "token-clear@test.com", "password": "Secure#Pass1"},
    )

    # First read — has token
    resp1 = await client.get("/auth/test/last-email-token")
    assert resp1.json()["token"] is not None

    # Second read — cleared
    resp2 = await client.get("/auth/test/last-email-token")
    assert resp2.json()["token"] is None


async def test_last_email_token_empty_initially(client: AsyncClient):
    """Before any email is sent, endpoint returns null."""
    # Clear any leftover state
    await client.get("/auth/test/last-email-token")

    resp = await client.get("/auth/test/last-email-token")
    assert resp.status_code == 200
    assert resp.json()["token"] is None
