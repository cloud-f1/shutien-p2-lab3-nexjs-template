"""Tests for the @idempotent decorator (E136)."""

from __future__ import annotations

import time

import pytest
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from httpx import ASGITransport, AsyncClient

from app.middleware.idempotency import (
    TTL_SECONDS,
    _idempotency_store,
    _store_lock,
    idempotent,
)

# ---------------------------------------------------------------------------
# Tiny test app with an idempotent endpoint
# ---------------------------------------------------------------------------

_call_count: int = 0


def _make_app() -> FastAPI:
    """Build a minimal FastAPI app with one idempotent endpoint."""
    test_app = FastAPI()

    @test_app.post("/create")
    @idempotent
    async def create_item(request: Request):
        global _call_count
        _call_count += 1
        return JSONResponse(
            status_code=201,
            content={"id": _call_count},
            media_type="application/json",
        )

    @test_app.post("/fail")
    @idempotent
    async def fail_item(request: Request):
        raise RuntimeError("boom")

    return test_app


_test_app = _make_app()


@pytest.fixture(autouse=True)
async def _reset_store():
    """Clear store and call counter between tests."""
    global _call_count
    _call_count = 0
    async with _store_lock:
        _idempotency_store.clear()
    yield
    async with _store_lock:
        _idempotency_store.clear()


@pytest.fixture()
async def client():
    async with AsyncClient(transport=ASGITransport(app=_test_app), base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------


async def test_first_request_with_key(client: AsyncClient):
    """First request with Idempotency-Key executes normally and caches."""
    resp = await client.post("/create", headers={"Idempotency-Key": "key-1"})
    assert resp.status_code == 201
    assert resp.json() == {"id": 1}
    # Store should contain the key
    assert "key-1" in _idempotency_store


async def test_cached_response_on_replay(client: AsyncClient):
    """Second request with same key returns the cached response."""
    headers = {"Idempotency-Key": "key-2"}
    resp1 = await client.post("/create", headers=headers)
    resp2 = await client.post("/create", headers=headers)

    assert resp1.status_code == 201
    assert resp2.status_code == 201
    # Body must be identical
    assert resp1.content == resp2.content
    # Handler must have been called only once
    assert _call_count == 1


async def test_no_key_normal_execution(client: AsyncClient):
    """Request without Idempotency-Key runs normally without caching."""
    resp1 = await client.post("/create")
    resp2 = await client.post("/create")

    assert resp1.status_code == 201
    assert resp2.status_code == 201
    # Both calls executed the handler
    assert resp1.json()["id"] == 1
    assert resp2.json()["id"] == 2
    assert _call_count == 2
    # Nothing cached
    assert len(_idempotency_store) == 0


async def test_concurrent_duplicate_returns_409(client: AsyncClient):
    """Concurrent requests with the same key: second gets 409 Conflict."""
    # Simulate in-progress entry
    async with _store_lock:
        _idempotency_store["key-concurrent"] = {
            "in_progress": True,
            "timestamp": time.time(),
        }

    resp = await client.post("/create", headers={"Idempotency-Key": "key-concurrent"})
    assert resp.status_code == 409
    body = resp.json()
    assert body["error"]["code"] == "idempotency_conflict"


async def test_expired_entries_cleaned(client: AsyncClient):
    """Expired entries are purged on the next request."""
    # Insert an already-expired entry
    async with _store_lock:
        _idempotency_store["old-key"] = {
            "body": b'{"old": true}',
            "status_code": 200,
            "media_type": "application/json",
            "timestamp": time.time() - TTL_SECONDS - 1,
            "in_progress": False,
        }

    # A new request triggers cleanup
    await client.post("/create", headers={"Idempotency-Key": "fresh-key"})
    assert "old-key" not in _idempotency_store
    assert "fresh-key" in _idempotency_store


async def test_different_keys_independent(client: AsyncClient):
    """Different idempotency keys produce independent responses."""
    resp_a = await client.post("/create", headers={"Idempotency-Key": "key-a"})
    resp_b = await client.post("/create", headers={"Idempotency-Key": "key-b"})

    assert resp_a.status_code == 201
    assert resp_b.status_code == 201
    assert resp_a.json()["id"] == 1
    assert resp_b.json()["id"] == 2
    assert _call_count == 2


async def test_handler_exception_clears_key(client: AsyncClient):
    """If the handler raises, the in-progress key is removed so it can be retried."""
    with pytest.raises(RuntimeError):
        await client.post("/fail", headers={"Idempotency-Key": "key-fail"})

    # Key should have been removed from the store
    assert "key-fail" not in _idempotency_store
