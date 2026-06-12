from unittest.mock import AsyncMock, patch

from httpx import AsyncClient


async def test_health(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("healthy", "degraded")
    assert data["version"] == "1.0.0"
    assert "database" in data


async def test_health_db_connected(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"


async def test_health_db_disconnected(client: AsyncClient):
    with patch(
        "app.api.v1.endpoints.health.AsyncSession.execute",
        new_callable=AsyncMock,
        side_effect=Exception("DB down"),
    ):
        response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "degraded"
    assert data["database"] == "disconnected"
