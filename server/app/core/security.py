"""Security primitives for refresh-token storage (E161).

Refresh tokens are JWT-encoded (see ``app.core.tokens``) but stored in the
``sessions`` table by **SHA-256 hash** so that a database compromise does
not leak usable bearer credentials. This module provides the small symmetric
hash + compare helpers used by the auth endpoints.

JWT signing/verification continues to live in ``app.core.tokens``.
"""

from __future__ import annotations

import hashlib
import hmac

from app.core.tokens import (  # re-export for callers that prefer this module
    create_refresh_token,
    hash_token,
    verify_refresh_token as verify_refresh_token_jwt,
)

__all__ = [
    "create_refresh_token",
    "hash_refresh_token",
    "hash_token",
    "verify_refresh_token",
    "verify_refresh_token_jwt",
]


def hash_refresh_token(rt: str) -> str:
    """Return the SHA-256 hex digest of a refresh token.

    Symmetric with :func:`app.core.tokens.hash_token` — kept under this name
    because the E161 spec references ``hash_refresh_token``. Both helpers
    produce identical output and either is safe to use.
    """
    return hashlib.sha256(rt.encode()).hexdigest()


def verify_refresh_token(rt: str, expected_hash: str) -> bool:
    """Constant-time compare a refresh token to a stored hash.

    Uses :func:`hmac.compare_digest` to prevent timing oracles when scanning
    the ``sessions`` table by ``token_hash``.
    """
    return hmac.compare_digest(hash_refresh_token(rt), expected_hash)
