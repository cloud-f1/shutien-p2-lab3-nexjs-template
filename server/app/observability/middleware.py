"""Request-ID middleware + per-request SLI sampling (E159 Part 2 + Part 3).

Adds a ``request_id`` (UUID4 by default; respects an inbound ``x-request-id``
header for distributed traces) to:

- ``structlog`` context vars (so every log line in the request scope inherits
  the field automatically — no plumbing needed in handlers)
- The ``x-request-id`` response header (so clients can correlate)

Per-request side effects:

- Emits one ``request`` log line on the way out with ``method``, ``path``,
  ``status``, ``duration_ms``.
- Records the sample to :mod:`app.observability.sli` so ``GET /admin/sli``
  can compute success rate + latency percentiles without an external store.

This is intentionally thin and ordering-insensitive — it can sit anywhere in
the middleware stack without breaking other middleware (CORS, rate limit,
correlation, etc.). It is wired in :mod:`app.main` after CORS but before the
correlation middleware so request_id is always present in logs even if the
older correlation_id stays as a separate dimension.
"""

from __future__ import annotations

import time
import uuid
from typing import Any

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

from app.observability import sli

log = structlog.get_logger("request")


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Bind ``request_id`` to log context + emit a per-request log line."""

    def __init__(self, app: ASGIApp, header_name: str = "x-request-id") -> None:
        super().__init__(app)
        self._header = header_name

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        rid = request.headers.get(self._header) or str(uuid.uuid4())
        structlog.contextvars.bind_contextvars(request_id=rid)
        start = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            response.headers[self._header] = rid
            return response
        finally:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            sli.record(path=request.url.path, status=status, duration_ms=duration_ms)
            log.info(
                "request",
                method=request.method,
                path=request.url.path,
                status=status,
                duration_ms=duration_ms,
            )
            structlog.contextvars.unbind_contextvars("request_id")
