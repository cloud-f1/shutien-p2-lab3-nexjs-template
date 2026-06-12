from httpx import AsyncClient

from app.core.config import settings


async def test_google_authorize_returns_redirect_url(client: AsyncClient):
    response = await client.get("/auth/google/authorize")
    assert response.status_code == 200
    data = response.json()
    assert "authorization_url" in data
    assert "accounts.google.com" in data["authorization_url"]


async def test_google_authorize_url_contains_client_id(client: AsyncClient):
    response = await client.get("/auth/google/authorize")
    data = response.json()
    assert "authorization_url" in data
    client_id = settings.GOOGLE_CLIENT_ID
    if not client_id:
        return  # skip if not configured
    assert client_id in data["authorization_url"]


async def test_github_authorize_returns_redirect_url(client: AsyncClient):
    """GitHub OAuth authorize returns URL when credentials are configured."""
    if not settings.GITHUB_CLIENT_ID:
        # GitHub not configured — endpoint should not exist (404)
        response = await client.get("/auth/github/authorize")
        assert response.status_code in (404, 405)
        return
    response = await client.get("/auth/github/authorize")
    assert response.status_code == 200
    data = response.json()
    assert "authorization_url" in data
    assert "github.com" in data["authorization_url"]


async def test_github_disabled_when_no_credentials(client: AsyncClient):
    """Without GITHUB_CLIENT_ID, the /auth/github/* endpoints return 404."""
    if settings.GITHUB_CLIENT_ID:
        return  # can't test disabled state when configured
    response = await client.get("/auth/github/authorize")
    assert response.status_code in (404, 405)
