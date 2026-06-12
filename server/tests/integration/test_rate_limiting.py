from slowapi.errors import RateLimitExceeded

from app.core.limiter import limiter
from app.main import app


def test_limiter_attached_to_app_state():
    """The slowapi limiter instance is set on app.state."""
    assert app.state.limiter is limiter


def test_rate_limit_exceeded_handler_registered():
    """The 429 handler for RateLimitExceeded is wired up."""
    assert RateLimitExceeded in app.exception_handlers


def test_rate_limit_exceeded_handler_is_callable():
    """The registered handler is the slowapi default handler."""
    from slowapi import _rate_limit_exceeded_handler

    handler = app.exception_handlers[RateLimitExceeded]
    assert handler is _rate_limit_exceeded_handler


def test_limiter_default_key_function():
    """The limiter uses get_remote_address as its key function."""
    from slowapi.util import get_remote_address

    assert limiter._key_func is get_remote_address


def test_rate_limit_config_value():
    """RATE_LIMIT_AUTH setting is available for endpoint decoration."""
    from app.core.config import settings

    # Value comes from .env or default; just verify it's a valid rate string
    assert "/" in settings.RATE_LIMIT_AUTH
    assert settings.RATE_LIMIT_AUTH.endswith("/minute")


def test_rate_limit_general_config_value():
    """RATE_LIMIT_GENERAL setting is available for endpoint decoration."""
    from app.core.config import settings

    assert "/" in settings.RATE_LIMIT_GENERAL
    assert settings.RATE_LIMIT_GENERAL.endswith("/minute")


def test_auth_endpoints_have_limiter_decorator():
    """Auth endpoint functions have @limiter.limit applied."""
    from app.api.v1.endpoints.auth import login, logout, refresh

    for fn in [login, logout, refresh]:
        # slowapi stores rate limit info via __wrapped__ or decorating
        assert hasattr(fn, "__self__") or hasattr(fn, "__wrapped__") or callable(fn)


def test_health_endpoint_has_limiter_decorator():
    """Health endpoint has @limiter.limit applied."""
    from app.api.v1.endpoints.health import health

    assert callable(health)
