"""Tests for the standardized error envelope (E132)."""

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel, Field

from app.middleware.error_envelope import (
    _classify_error,
    _extract_code,
    register_error_handlers,
)


# ---------------------------------------------------------------------------
# Helpers — minimal app that raises exceptions for testing
# ---------------------------------------------------------------------------


def _make_app() -> FastAPI:
    """Create a throw-away FastAPI app with error handlers registered."""
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/raise/{status_code}")
    async def raise_http(status_code: int):
        raise HTTPException(status_code=status_code, detail="test error")

    @app.get("/raise-dict")
    async def raise_dict():
        raise HTTPException(status_code=400, detail={"code": "CUSTOM", "info": "x"})

    class StrictBody(BaseModel):
        name: str = Field(..., min_length=1)
        age: int

    @app.post("/validate")
    async def validate_body(body: StrictBody):
        return {"ok": True}

    return app


@pytest.fixture()
async def envelope_client():
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# Unit tests for _classify_error
# ---------------------------------------------------------------------------


class TestClassifyError:
    def test_401_authentication(self):
        assert _classify_error(401) == "authentication_error"

    def test_403_authorization(self):
        assert _classify_error(403) == "authorization_error"

    def test_404_not_found(self):
        assert _classify_error(404) == "not_found_error"

    def test_409_conflict(self):
        assert _classify_error(409) == "conflict_error"

    def test_422_validation(self):
        assert _classify_error(422) == "validation_error"

    def test_429_rate_limit(self):
        assert _classify_error(429) == "rate_limit_error"

    def test_400_invalid_request(self):
        assert _classify_error(400) == "invalid_request_error"

    def test_418_invalid_request(self):
        assert _classify_error(418) == "invalid_request_error"

    def test_500_api_error(self):
        assert _classify_error(500) == "api_error"

    def test_502_api_error(self):
        assert _classify_error(502) == "api_error"


# ---------------------------------------------------------------------------
# Unit tests for _extract_code
# ---------------------------------------------------------------------------


class TestExtractCode:
    def test_string_detail(self):
        assert _extract_code("not found") == "NOT_FOUND"

    def test_dict_detail_with_code(self):
        assert _extract_code({"code": "DUPLICATE"}) == "DUPLICATE"

    def test_dict_detail_without_code(self):
        assert _extract_code({"info": "x"}) == "ERROR"

    def test_non_string_non_dict(self):
        assert _extract_code(42) == "ERROR"


# ---------------------------------------------------------------------------
# Integration tests — HTTP through the envelope handlers
# ---------------------------------------------------------------------------


class TestHTTPExceptionEnvelope:
    async def test_envelope_shape(self, envelope_client: AsyncClient):
        resp = await envelope_client.get("/raise/400")
        assert resp.status_code == 400
        body = resp.json()
        assert "error" in body
        error = body["error"]
        assert set(error.keys()) >= {"type", "code", "message"}

    @pytest.mark.parametrize(
        "status,expected_type",
        [
            (401, "authentication_error"),
            (403, "authorization_error"),
            (404, "not_found_error"),
            (409, "conflict_error"),
            (422, "validation_error"),
            (429, "rate_limit_error"),
            (400, "invalid_request_error"),
        ],
    )
    async def test_type_classification(
        self, envelope_client: AsyncClient, status: int, expected_type: str
    ):
        resp = await envelope_client.get(f"/raise/{status}")
        assert resp.json()["error"]["type"] == expected_type

    async def test_message_is_detail_string(self, envelope_client: AsyncClient):
        resp = await envelope_client.get("/raise/404")
        assert resp.json()["error"]["message"] == "test error"

    async def test_dict_detail_preserved(self, envelope_client: AsyncClient):
        resp = await envelope_client.get("/raise-dict")
        body = resp.json()
        assert body["error"]["code"] == "CUSTOM"
        # dict detail is passed through as message
        assert isinstance(body["error"]["message"], dict)


class TestValidationEnvelope:
    async def test_validation_envelope_shape(self, envelope_client: AsyncClient):
        resp = await envelope_client.post("/validate", json={})
        assert resp.status_code == 422
        body = resp.json()
        assert body["error"]["type"] == "validation_error"
        assert "details" in body["error"]
        assert isinstance(body["error"]["details"], list)

    async def test_validation_param_populated(self, envelope_client: AsyncClient):
        resp = await envelope_client.post("/validate", json={})
        details = resp.json()["error"]["details"]
        params = [d["param"] for d in details]
        # Both 'name' and 'age' are missing — their params should appear
        assert any("name" in p for p in params)
        assert any("age" in p for p in params)

    async def test_validation_single_field(self, envelope_client: AsyncClient):
        resp = await envelope_client.post("/validate", json={"name": "ok"})
        assert resp.status_code == 422
        error = resp.json()["error"]
        # Only 'age' is missing
        assert "age" in error["param"]
