"""Observability layer (E159) — Sentry init, structured logs, SLI aggregation.

Public API:
- ``init_sentry()``: server Sentry SDK initialization with fail-fast prod guard
- ``configure_structlog()``: idempotent structlog wiring (delegates to
  ``app.core.logging_config.setup_logging``)
- ``RequestIDMiddleware``: per-request UUID4 ``request_id`` + duration logging
- ``sli`` module: in-memory rolling SLI aggregator consumed by ``/admin/sli``
"""

from app.observability.logging import configure_structlog
from app.observability.middleware import RequestIDMiddleware
from app.observability.sentry import init_sentry

__all__ = [
    "RequestIDMiddleware",
    "configure_structlog",
    "init_sentry",
]
