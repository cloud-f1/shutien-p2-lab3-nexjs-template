from starlette.middleware.cors import CORSMiddleware

from app.main import app


def test_app_title_and_version():
    assert app.title == "AI-Coding-Template API"
    assert app.version == "1.0.0"


def test_cors_middleware_configured():
    middleware_classes = [m.cls for m in app.user_middleware]
    assert CORSMiddleware in middleware_classes


def test_all_router_prefixes_registered():
    routes = {r.path for r in app.routes}
    assert any(r.startswith("/auth") for r in routes), f"/auth not in {routes}"
    assert any(r.startswith("/users") for r in routes), f"/users not in {routes}"
    assert "/health" in routes, f"/health not in {routes}"


def test_rate_limit_handler_registered():
    from slowapi.errors import RateLimitExceeded

    assert RateLimitExceeded in app.exception_handlers
