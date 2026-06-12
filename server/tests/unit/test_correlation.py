"""Tests for correlation ID middleware."""

import ast
import json

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture()
async def bare_client():
    """Client without dependency overrides — tests middleware only."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_correlation_id_generated(bare_client: AsyncClient):
    """When no X-Correlation-ID header is sent, the response contains one."""
    resp = await bare_client.get("/health")
    cid = resp.headers.get("X-Correlation-ID")
    assert cid is not None
    assert len(cid) == 36  # UUID format


async def test_correlation_id_passthrough(bare_client: AsyncClient):
    """When X-Correlation-ID header is sent, the response echoes the same value."""
    custom_id = "my-custom-correlation-id-999"
    resp = await bare_client.get("/health", headers={"X-Correlation-ID": custom_id})
    assert resp.headers.get("X-Correlation-ID") == custom_id


def _parse_structlog_record(record) -> dict:
    """Extract structured data from a structlog-formatted log record."""
    msg = record.getMessage()
    try:
        return json.loads(msg)
    except (json.JSONDecodeError, TypeError):
        pass
    try:
        return ast.literal_eval(msg)
    except (ValueError, SyntaxError):
        return {}


async def test_correlation_id_in_logs(bare_client: AsyncClient, caplog):
    """Request logs include the correlation_id field."""
    custom_id = "test-log-correlation-123"
    with caplog.at_level("INFO", logger="http"):
        # Use a non-health path so RequestLoggingMiddleware emits the log
        resp = await bare_client.get(
            "/nonexistent-route-for-correlation-test",
            headers={"X-Correlation-ID": custom_id},
        )
    assert resp.status_code in (404, 405)
    # Find the request_completed log record with correlation_id
    found = False
    for record in caplog.records:
        data = _parse_structlog_record(record)
        if data.get("correlation_id") == custom_id:
            found = True
            break
    assert found, "Expected correlation_id in http log records"
