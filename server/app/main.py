from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.limiter import limiter
from app.observability import init_sentry
from app.observability.logging import configure_structlog

# Sentry first — fail-fast in production if DSN is missing (E159 Part 1).
# Reads SENTRY_DSN_SERVER (preferred) or legacy SENTRY_DSN.
init_sentry()

# Structured logging (E159 Part 2 — delegates to app.core.logging_config).
configure_structlog()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: fail fast if production config is insecure (E104)
    settings.validate_production_config()
    yield
    # Shutdown: release resources here if needed


app = FastAPI(
    title="AI-Coding-Template API",
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

from app.middleware.error_envelope import register_error_handlers  # noqa: E402

register_error_handlers(app)

# Middleware order (LIFO — last added executes first):
# 1. CorrelationMiddleware (outermost — generates correlation_id)
# 2. RequestLoggingMiddleware (logs full request lifecycle)
# 3. SecurityHeadersMiddleware
# 4. CORSMiddleware
# 5. SlowAPI (rate limiter)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-Correlation-ID",
        "X-Team-Id",
        "Idempotency-Key",
    ],
)

from app.middleware.security_headers import SecurityHeadersMiddleware  # noqa: E402

app.add_middleware(SecurityHeadersMiddleware)

from app.middleware.request_logging import RequestLoggingMiddleware  # noqa: E402

app.add_middleware(RequestLoggingMiddleware)

from app.middleware.correlation import CorrelationMiddleware  # noqa: E402

app.add_middleware(CorrelationMiddleware)

from app.observability.middleware import RequestIDMiddleware  # noqa: E402

# RequestIDMiddleware is added AFTER CorrelationMiddleware in source order,
# which means it executes FIRST (Starlette is LIFO). request_id is therefore
# the outermost piece of the per-request log context — present even on
# requests that bypass the correlation layer (e.g. exception paths).
app.add_middleware(RequestIDMiddleware)

from app.api.v1.endpoints import admin, auth, health, sessions, social, test_helpers, users  # noqa: E402

# Core routers (auth, users, health — always present)
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(social.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(sessions.router, prefix="/users/me/sessions", tags=["users"])
app.include_router(health.router, tags=["health"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(test_helpers.router, prefix="/api/v1/test-helpers", tags=["test-helpers"])

# Domain routers (auto-discovered from app/domains/)
from app.domains import discover_domains  # noqa: E402

for domain in discover_domains():
    app.include_router(domain.router, prefix=domain.prefix, tags=domain.tags)
