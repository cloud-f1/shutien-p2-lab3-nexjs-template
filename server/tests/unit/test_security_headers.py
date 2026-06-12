"""Tests for the SecurityHeadersMiddleware."""

from unittest.mock import patch

from app.main import app
from app.middleware.security_headers import SecurityHeadersMiddleware


def test_security_headers_middleware_registered():
    """SecurityHeadersMiddleware is registered in the app middleware stack."""
    middleware_classes = [m.cls for m in app.user_middleware]
    assert SecurityHeadersMiddleware in middleware_classes


async def test_response_includes_x_content_type_options(client):
    resp = await client.get("/health")
    assert resp.headers["X-Content-Type-Options"] == "nosniff"


async def test_response_includes_x_frame_options(client):
    resp = await client.get("/health")
    assert resp.headers["X-Frame-Options"] == "DENY"


async def test_response_includes_x_xss_protection(client):
    resp = await client.get("/health")
    assert resp.headers["X-XSS-Protection"] == "0"


async def test_response_includes_referrer_policy(client):
    resp = await client.get("/health")
    assert resp.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"


async def test_response_includes_permissions_policy(client):
    resp = await client.get("/health")
    assert resp.headers["Permissions-Policy"] == "camera=(), microphone=(), geolocation=()"


async def test_response_includes_csp(client):
    resp = await client.get("/health")
    csp = resp.headers["Content-Security-Policy"]
    assert "default-src 'self'" in csp
    assert "script-src 'self'" in csp
    assert "frame-ancestors 'none'" in csp


async def test_csp_does_not_include_stripe(client):
    """CSP should not include Stripe directives in core template."""
    resp = await client.get("/health")
    csp = resp.headers["Content-Security-Policy"]
    assert "stripe.com" not in csp


async def test_hsts_not_present_in_development(client):
    """HSTS header should NOT be present in development environment."""
    resp = await client.get("/health")
    assert "Strict-Transport-Security" not in resp.headers


async def test_hsts_present_in_production(client):
    """HSTS header should be present when ENVIRONMENT=production."""
    with patch("app.middleware.security_headers.settings") as mock_settings:
        mock_settings.ENVIRONMENT = "production"
        resp = await client.get("/health")
        assert (
            resp.headers.get("Strict-Transport-Security") == "max-age=31536000; includeSubDomains"
        )


async def test_security_headers_on_non_health_endpoint(client):
    """Security headers are applied to all endpoints, not just /health."""
    resp = await client.post(
        "/auth/jwt/login",
        data={"username": "nonexistent@test.com", "password": "wrong"},
    )
    # Even on a 400 response, security headers should be present
    assert resp.headers["X-Content-Type-Options"] == "nosniff"
    assert resp.headers["X-Frame-Options"] == "DENY"
