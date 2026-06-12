"""Tests for request logging middleware."""

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


def _parse_structlog_record(record) -> dict:
    """Extract structured data from a structlog-formatted log record.

    structlog's ProcessorFormatter stores the event_dict as the record's
    msg (a dict) before the renderer turns it into a string.
    """
    msg = record.getMessage()
    # Try JSON parse first (json renderer)
    try:
        return json.loads(msg)
    except (json.JSONDecodeError, TypeError):
        pass
    # Try ast.literal_eval for dict repr (safe — only evaluates literals)
    try:
        return ast.literal_eval(msg)
    except (ValueError, SyntaxError):
        return {}


async def test_request_log_fields(bare_client: AsyncClient, caplog):
    """A non-health request produces a log with method, path, status_code, duration_ms."""
    with caplog.at_level("INFO", logger="http"):
        resp = await bare_client.get("/nonexistent-route-for-log-test")

    http_records = [r for r in caplog.records if r.name == "http"]
    assert len(http_records) >= 1
    data = _parse_structlog_record(http_records[-1])
    assert data["method"] == "GET"
    assert data["path"] == "/nonexistent-route-for-log-test"
    assert data["status_code"] == resp.status_code
    assert isinstance(data["duration_ms"], float)
    assert data["duration_ms"] >= 0


async def test_request_log_error_status(bare_client: AsyncClient, caplog):
    """A 404 response is logged with the correct status_code."""
    with caplog.at_level("INFO", logger="http"):
        resp = await bare_client.get("/nonexistent-route-xyz")
    assert resp.status_code in (404, 405)  # FastAPI may return 404 or 405

    http_records = [r for r in caplog.records if r.name == "http"]
    assert len(http_records) >= 1
    data = _parse_structlog_record(http_records[-1])
    assert data["status_code"] == resp.status_code
