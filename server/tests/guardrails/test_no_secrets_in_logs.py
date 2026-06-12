"""Guardrail: no secrets (keys, passwords, JWTs) leak into log output."""

import logging
import re

from httpx import AsyncClient

from app.core.config import settings

_TEST_EMAIL = "guardrail-logs@test.com"
_TEST_PASSWORD = "Secure#Pass1"

# JWT prefix pattern (base64-encoded JSON starting with {"alg":...)
_JWT_RE = re.compile(r"eyJ[A-Za-z0-9_-]{10,}")


def _assert_no_secrets_in_logs(log_text: str) -> None:
    """Raise AssertionError if secret material appears in captured logs."""
    # Check SECRET_KEY (skip if it's the test default placeholder)
    if settings.SECRET_KEY and len(settings.SECRET_KEY) > 8:
        assert settings.SECRET_KEY not in log_text, "SECRET_KEY leaked in logs"

    # Check REFRESH_SECRET_KEY
    if settings.REFRESH_SECRET_KEY and len(settings.REFRESH_SECRET_KEY) > 8:
        assert settings.REFRESH_SECRET_KEY not in log_text, "REFRESH_SECRET_KEY leaked in logs"

    # Check raw password
    assert _TEST_PASSWORD not in log_text, "Raw password leaked in logs"

    # Check JWT tokens
    jwt_matches = _JWT_RE.findall(log_text)
    assert not jwt_matches, f"JWT token(s) leaked in logs: {jwt_matches[:3]}"


async def _register_and_login(client: AsyncClient) -> dict:
    """Register a user and login, returning the login response data."""
    await client.post(
        "/auth/register",
        json={"email": _TEST_EMAIL, "password": _TEST_PASSWORD},
    )
    response = await client.post(
        "/auth/jwt/login",
        data={"username": _TEST_EMAIL, "password": _TEST_PASSWORD},
    )
    return response.json() if response.status_code == 200 else {}


async def test_login_logs_no_secrets(client: AsyncClient, caplog):
    """Login operation must not log secrets, passwords, or tokens."""
    with caplog.at_level(logging.DEBUG):
        await _register_and_login(client)

    _assert_no_secrets_in_logs(caplog.text)


async def test_failed_login_logs_no_secrets(client: AsyncClient, caplog):
    """Failed login must not log the attempted password."""
    with caplog.at_level(logging.DEBUG):
        await client.post(
            "/auth/jwt/login",
            data={"username": "nobody@test.com", "password": _TEST_PASSWORD},
        )

    _assert_no_secrets_in_logs(caplog.text)


async def test_register_logs_no_secrets(client: AsyncClient, caplog):
    """Registration must not log the password."""
    with caplog.at_level(logging.DEBUG):
        await client.post(
            "/auth/register",
            json={"email": "guardrail-reg@test.com", "password": _TEST_PASSWORD},
        )

    _assert_no_secrets_in_logs(caplog.text)


async def test_token_refresh_logs_no_secrets(client: AsyncClient, caplog):
    """Token refresh must not log tokens or secrets."""
    login_data = await _register_and_login(client)
    refresh_token = login_data.get("refresh_token", "")

    with caplog.at_level(logging.DEBUG):
        if refresh_token:
            await client.post(
                "/auth/refresh",
                json={"refresh_token": refresh_token},
            )
        else:
            # If no refresh token in response, just verify login logs are clean
            pass

    _assert_no_secrets_in_logs(caplog.text)
