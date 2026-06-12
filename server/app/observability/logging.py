"""Structured JSON logging configuration (E159 Part 2).

Thin wrapper around :func:`app.core.logging_config.setup_logging`. Exposes a
stable name (``configure_structlog``) per the E159 spec while reusing the
existing structlog processor chain — there is exactly one logging configuration
in the process, no double-init.

The chain (already proven by E108 / E115 tests):

1. ``contextvars.merge_contextvars`` — pulls ``request_id``, ``user_id`` from
   the active request scope (bound by :class:`RequestIDMiddleware`).
2. ``add_log_level`` — emits ``level`` field.
3. ``TimeStamper(iso, utc)`` — emits ``timestamp``.
4. Render: ``JSONRenderer`` when ``LOG_FORMAT=json``; ``ConsoleRenderer``
   otherwise. Production should always set ``LOG_FORMAT=json``.

Sentry breadcrumbs piggy-back on stdlib logging (handled by
``sentry_sdk.integrations.logging.LoggingIntegration``, which is auto-enabled
by the FastAPI/SQLAlchemy integrations in :mod:`app.observability.sentry`),
so structured fields land in Sentry events automatically.
"""

from __future__ import annotations

from app.core.logging_config import setup_logging


def configure_structlog() -> None:
    """Idempotent structlog setup. Safe to call multiple times."""

    setup_logging()
