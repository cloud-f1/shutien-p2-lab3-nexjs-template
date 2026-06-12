"""Admin-only endpoints — superuser required."""

import logging
import os
import time
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import fastapi_users
from app.core.config import settings
from app.core.limiter import limiter
from app.db.session import engine, get_db
from app.models.user import User
from app.observability import sli as sli_module

logger = logging.getLogger(__name__)

router = APIRouter()

current_superuser = fastapi_users.current_user(active=True, superuser=True)

# Track process start time for uptime calculation
_process_start_time = time.monotonic()


# ── Response schemas ────────────────────────────────────────────


class DbHealth(BaseModel):
    status: str
    latency_ms: float


class EmailHealth(BaseModel):
    provider: str
    configured: bool


class OAuthHealth(BaseModel):
    providers: list[str]


class AppHealth(BaseModel):
    version: str
    uptime_seconds: float
    environment: str


class AdminHealthResponse(BaseModel):
    db: DbHealth
    email: EmailHealth
    oauth: OAuthHealth
    app: AppHealth


class DbPoolStats(BaseModel):
    """SQLAlchemy connection-pool snapshot.

    Fields are best-effort: SQLite (test) returns ``-1`` for unsupported
    counters; PostgreSQL via QueuePool returns real values. Operators reading
    the dashboard care about ``checked_out`` (active connections) most.
    """

    size: int
    checked_in: int
    checked_out: int
    overflow: int


class EndpointSli(BaseModel):
    path: str
    count: int
    success_rate: float
    p50_ms: float
    p95_ms: float


class SliResponse(BaseModel):
    """E159 health SLI snapshot. Superuser-only.

    All counters are in-process — no external metric store. Multi-replica
    deploys see only the replica that served the request; that is acceptable
    for triage. For cross-replica aggregation, point Sentry / Zeabur dashboards
    at the same field names.
    """

    window_seconds: int
    sample_count: int
    success_rate_5m: float
    p50_ms: float
    p95_ms: float
    top_endpoints: list[EndpointSli]
    db_pool: DbPoolStats
    release: str
    environment: str


# ── Endpoint ────────────────────────────────────────────────────


@router.get("/health", response_model=AdminHealthResponse)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def admin_health(
    request: Request,
    _user: User = Depends(current_superuser),
    db: AsyncSession = Depends(get_db),
) -> AdminHealthResponse:
    """Detailed system health — superuser only."""

    # DB check with latency
    db_status = "disconnected"
    latency_ms = 0.0
    try:
        start = time.monotonic()
        await db.execute(text("SELECT 1"))
        latency_ms = round((time.monotonic() - start) * 1000, 2)
        db_status = "connected"
    except Exception:
        logger.warning("Admin health: database unreachable")

    # Email provider detection
    email_provider = settings.EMAIL_PROVIDER
    email_configured = False
    if email_provider == "mailgun":
        email_configured = bool(settings.MAILGUN_API_KEY and settings.MAILGUN_DOMAIN)
    elif email_provider == "zeabur":
        email_configured = bool(settings.ZEABUR_EMAIL_API_KEY)
    elif email_provider == "console":
        email_configured = True  # Console provider always works

    # OAuth providers
    oauth_providers: list[str] = []
    if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET:
        oauth_providers.append("google")
    if settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET:
        oauth_providers.append("github")

    # App info
    uptime_seconds = round(time.monotonic() - _process_start_time, 2)

    return AdminHealthResponse(
        db=DbHealth(status=db_status, latency_ms=latency_ms),
        email=EmailHealth(provider=email_provider, configured=email_configured),
        oauth=OAuthHealth(providers=oauth_providers),
        app=AppHealth(
            version=settings.APP_VERSION,
            uptime_seconds=uptime_seconds,
            environment=settings.ENVIRONMENT,
        ),
    )


def _db_pool_stats() -> DbPoolStats:
    """Best-effort connection-pool stats. Returns ``-1`` on unsupported pools."""

    pool: Any = engine.pool
    # AsyncEngine wraps a sync pool; the public counters live on the underlying pool.
    try:
        size = int(pool.size())
        checked_in = int(pool.checkedin())
        checked_out = int(pool.checkedout())
        overflow = int(pool.overflow())
    except Exception:
        # NullPool / SingletonThreadPool (SQLite test): no meaningful counters.
        return DbPoolStats(size=-1, checked_in=-1, checked_out=-1, overflow=-1)
    return DbPoolStats(size=size, checked_in=checked_in, checked_out=checked_out, overflow=overflow)


@router.get("/sli", response_model=SliResponse)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def admin_sli(
    request: Request,
    _user: User = Depends(current_superuser),
) -> SliResponse:
    """Rolling Service-Level Indicators — superuser only (E159 Part 3).

    Aggregates the in-process request log over a 5-minute trailing window.
    Pair with the Zeabur dashboard / Sentry for cross-replica truth.
    """

    snap = sli_module.snapshot()
    return SliResponse(
        window_seconds=snap["window_seconds"],
        sample_count=snap["sample_count"],
        success_rate_5m=snap["success_rate_5m"],
        p50_ms=snap["p50_ms"],
        p95_ms=snap["p95_ms"],
        top_endpoints=[EndpointSli(**ep) for ep in snap["top_endpoints"]],
        db_pool=_db_pool_stats(),
        release=os.getenv("GIT_SHA", "unknown"),
        environment=settings.ENVIRONMENT,
    )
