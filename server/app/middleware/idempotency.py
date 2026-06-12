"""Idempotency-Key decorator for POST/PATCH endpoints.

Usage:
    @router.post("/example")
    @idempotent
    async def create_example(request: Request, ...):
        ...

When a client sends an ``Idempotency-Key`` header the first response is
cached in-memory (24 h TTL).  Subsequent requests with the same key replay
the cached response without re-executing the handler.  Concurrent duplicates
receive a 409 Conflict.

The in-memory store is sufficient for single-process deployments.  Swap to
Redis by checking ``settings.REDIS_URL`` when the project adds one.
"""

from __future__ import annotations

import asyncio
import time
from functools import wraps
from typing import Any, Callable

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.responses import Response

# ---------------------------------------------------------------------------
# In-memory store
# ---------------------------------------------------------------------------

_idempotency_store: dict[str, dict[str, Any]] = {}
_store_lock = asyncio.Lock()
TTL_SECONDS = 86400  # 24 hours


async def _cleanup_expired() -> None:
    """Remove entries older than *TTL_SECONDS*.  Called under lock."""
    now = time.time()
    expired = [k for k, v in _idempotency_store.items() if now - v["timestamp"] > TTL_SECONDS]
    for k in expired:
        del _idempotency_store[k]


def _extract_request(*args: Any, **kwargs: Any) -> Request | None:
    """Find the FastAPI ``Request`` object from positional/keyword args."""
    if "request" in kwargs:
        return kwargs["request"]
    for arg in args:
        if isinstance(arg, Request):
            return arg
    return None


# ---------------------------------------------------------------------------
# Public decorator
# ---------------------------------------------------------------------------


def idempotent(func: Callable) -> Callable:  # noqa: C901 — intentional complexity
    """Decorator that makes an endpoint idempotent via ``Idempotency-Key`` header.

    * Missing header → normal (uncached) execution.
    * First call with a given key → execute, cache response.
    * Repeat call with same key → replay cached response.
    * Concurrent call with same in-progress key → ``409 Conflict``.
    """

    @wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Response:
        request = _extract_request(*args, **kwargs)
        if request is None:
            return await func(*args, **kwargs)

        key = request.headers.get("Idempotency-Key")
        if not key:
            # No key — proceed without caching
            return await func(*args, **kwargs)

        async with _store_lock:
            await _cleanup_expired()

            if key in _idempotency_store:
                cached = _idempotency_store[key]
                if cached.get("in_progress"):
                    return JSONResponse(
                        status_code=409,
                        content={
                            "error": {
                                "type": "conflict_error",
                                "code": "idempotency_conflict",
                                "message": (
                                    "A request with this idempotency key is "
                                    "currently being processed"
                                ),
                            }
                        },
                    )
                # Replay cached response
                return Response(
                    content=cached["body"],
                    status_code=cached["status_code"],
                    media_type=cached.get("media_type"),
                )

            # Mark key as in-progress
            _idempotency_store[key] = {"in_progress": True, "timestamp": time.time()}

        # Execute the actual handler outside the lock
        try:
            response = await func(*args, **kwargs)

            # Extract body bytes
            body = b""
            if hasattr(response, "body"):
                body = response.body

            async with _store_lock:
                _idempotency_store[key] = {
                    "body": body,
                    "status_code": response.status_code,
                    "media_type": getattr(response, "media_type", None),
                    "timestamp": time.time(),
                    "in_progress": False,
                }
            return response
        except Exception:
            # On failure, remove the in-progress marker so the key can be retried
            async with _store_lock:
                _idempotency_store.pop(key, None)
            raise

    return wrapper
