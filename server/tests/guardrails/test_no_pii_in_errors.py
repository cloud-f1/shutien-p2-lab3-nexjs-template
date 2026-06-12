"""Guardrail: no PII (emails, phones, passwords) leaks in error responses."""

import re

import pytest
from httpx import AsyncClient

# ── PII patterns ────────────────────────────────────────────────────────

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"\+?\d{10,15}")
PASSWORD_VALUE_RE = re.compile(r"password\s*[:=]\s*\S+", re.IGNORECASE)

# Known safe strings that are NOT PII leaks (e.g. schema field names)
_SAFE_EMAIL_LITERALS = {"username", "email"}

_TEST_EMAIL = "guardrail-pii@test.com"
_TEST_PASSWORD = "Secure#Pass1"


def _assert_no_pii(body_text: str) -> None:
    """Raise AssertionError if PII patterns appear in the response body."""
    emails_found = EMAIL_RE.findall(body_text)
    # Filter out safe field-name-only occurrences that aren't real addresses
    real_emails = [e for e in emails_found if e not in _SAFE_EMAIL_LITERALS]
    assert not real_emails, f"Email PII leaked in response: {real_emails}"

    phones_found = PHONE_RE.findall(body_text)
    assert not phones_found, f"Phone PII leaked in response: {phones_found}"

    password_found = PASSWORD_VALUE_RE.findall(body_text)
    assert not password_found, f"Password value leaked in response: {password_found}"


# ── Helpers ─────────────────────────────────────────────────────────────


async def _register(client: AsyncClient, email: str = _TEST_EMAIL) -> None:
    await client.post(
        "/auth/register",
        json={"email": email, "password": _TEST_PASSWORD},
    )


# ── Tests ───────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "method, url, kwargs, setup, expected_status",
    [
        pytest.param(
            "POST",
            "/auth/jwt/login",
            {"data": {"username": _TEST_EMAIL, "password": "WrongPassword1"}},
            True,
            400,
            id="login_bad_credentials",
        ),
        pytest.param(
            "GET",
            "/users/me",
            {},
            False,
            401,
            id="users_me_no_auth",
        ),
        pytest.param(
            "POST",
            "/auth/register",
            {"json": {"email": _TEST_EMAIL, "password": _TEST_PASSWORD}},
            True,  # register first so second attempt is duplicate
            400,
            id="register_duplicate_email",
        ),
        pytest.param(
            "POST",
            "/auth/register",
            {"json": {}},
            False,
            422,
            id="register_missing_fields",
        ),
        pytest.param(
            "POST",
            "/auth/jwt/login",
            {"data": {"username": "nonexistent@test.com", "password": "Whatever1"}},
            False,
            400,
            id="login_nonexistent_user",
        ),
    ],
)
async def test_error_responses_contain_no_pii(
    client: AsyncClient,
    method: str,
    url: str,
    kwargs: dict,
    setup: bool,
    expected_status: int,
):
    """Error responses must never contain PII patterns."""
    if setup:
        await _register(client)

    response = await getattr(client, method.lower())(url, **kwargs)
    assert response.status_code == expected_status
    _assert_no_pii(response.text)
