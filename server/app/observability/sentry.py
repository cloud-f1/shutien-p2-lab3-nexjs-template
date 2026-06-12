"""Sentry SDK initialization (E159 Part 1).

Single entry point: :func:`init_sentry`. Called once at app startup.

Behaviour summary:

- Reads ``SENTRY_DSN_SERVER`` (preferred) — falls back to legacy ``SENTRY_DSN``
  for backwards compatibility with existing deployments.
- ``ENVIRONMENT=production`` + empty DSN -> raises ``RuntimeError`` (fail-fast).
  All other environments are silent no-ops when the DSN is empty.
- ``release`` tag is taken from ``GIT_SHA`` env (else ``"unknown"``) so Sentry
  can deep-link stack traces to commits.
- Sample rates: 10% in production, 100% elsewhere. Profiling: 10% in prod,
  off in dev (saves battery during local work).
- ``send_default_pii=False`` — GDPR-safe default; opt-in only.
"""

from __future__ import annotations

import os

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration


def _resolve_dsn() -> str:
    """Prefer ``SENTRY_DSN_SERVER`` (E159 contract); fall back to ``SENTRY_DSN``.

    The legacy ``SENTRY_DSN`` env was the original contract (set by
    `app.main` before E159). Keeping the fallback prevents existing
    Zeabur deployments from breaking the moment this module ships.
    """

    return os.getenv("SENTRY_DSN_SERVER") or os.getenv("SENTRY_DSN", "")


def init_sentry() -> None:
    """Initialise the Sentry SDK for the server process.

    Raises:
        RuntimeError: when ``ENVIRONMENT=production`` and no DSN is configured.
            This is a hard fail because shipping prod without error tracking
            is the silent failure mode E159 was created to eliminate.
    """

    dsn = _resolve_dsn()
    env = os.getenv("ENVIRONMENT", "development")

    if env == "production" and not dsn:
        raise RuntimeError(
            "SENTRY_DSN_SERVER is required when ENVIRONMENT=production. "
            "Set it in Zeabur (or your platform secrets) before deploy. "
            "Local/staging may leave it empty for a silent no-op."
        )

    if not dsn:
        return  # dev/test: Sentry off — silent no-op

    sentry_sdk.init(
        dsn=dsn,
        environment=env,
        release=os.getenv("GIT_SHA", "unknown"),
        traces_sample_rate=0.1 if env == "production" else 1.0,
        profiles_sample_rate=0.1 if env == "production" else 0.0,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        send_default_pii=False,
    )
