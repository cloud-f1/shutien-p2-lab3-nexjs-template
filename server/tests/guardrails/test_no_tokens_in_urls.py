"""Guardrail: no JWT tokens or access tokens leak in URLs or redirects."""

import re

from httpx import AsyncClient

# Patterns that must NEVER appear in URL query strings.
# Note: OAuth `state` params may legitimately contain JWTs (CSRF tokens from
# fastapi-users). We only flag access/refresh tokens leaked as query params.
_TOKEN_QUERY_PATTERNS = [
    re.compile(r"[?&]access_token=", re.IGNORECASE),
    re.compile(r"[?&]token=", re.IGNORECASE),
    re.compile(r"[?&]refresh_token=", re.IGNORECASE),
]


def _assert_no_tokens_in_url(url: str) -> None:
    """Raise AssertionError if a URL contains leaked auth tokens in query params."""
    for pattern in _TOKEN_QUERY_PATTERNS:
        assert not pattern.search(url), (
            f"Token leaked in URL: pattern={pattern.pattern!r}, url={url}"
        )


async def test_google_authorize_url_has_no_tokens(client: AsyncClient):
    """GET /auth/google/authorize should return authorization_url without tokens."""
    response = await client.get("/auth/google/authorize")
    # If Google OAuth is not configured, endpoint may return 422 or similar —
    # we still check the response body for token leaks regardless.
    if response.status_code == 200:
        data = response.json()
        authorization_url = data.get("authorization_url", "")
        _assert_no_tokens_in_url(authorization_url)
    # Regardless of status, the raw response text should not contain JWTs
    _assert_no_tokens_in_url(response.text)


async def test_github_authorize_url_has_no_tokens(client: AsyncClient):
    """GET /auth/github/authorize should return authorization_url without tokens."""
    response = await client.get("/auth/github/authorize")
    # GitHub OAuth may not be configured in test env — 404 is acceptable
    if response.status_code == 200:
        data = response.json()
        authorization_url = data.get("authorization_url", "")
        _assert_no_tokens_in_url(authorization_url)
    _assert_no_tokens_in_url(response.text)


async def test_redirect_responses_have_no_tokens(client: AsyncClient):
    """Any redirect Location header must not contain tokens."""
    # Try endpoints that might redirect
    endpoints = [
        "/auth/google/authorize",
        "/auth/github/authorize",
    ]
    for url in endpoints:
        response = await client.get(url, follow_redirects=False)
        location = response.headers.get("location", "")
        if location:
            _assert_no_tokens_in_url(location)
