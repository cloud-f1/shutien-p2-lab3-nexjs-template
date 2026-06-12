from app.core.auth import bearer_transport, get_jwt_strategy
from app.core.config import settings


def test_jwt_strategy_uses_secret_key():
    strategy = get_jwt_strategy()
    assert strategy.secret == settings.SECRET_KEY


def test_jwt_strategy_lifetime_matches_settings():
    strategy = get_jwt_strategy()
    expected = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    assert strategy.lifetime_seconds == expected


def test_bearer_transport_token_url():
    scheme = bearer_transport.scheme
    # OAuth2PasswordBearer stores token URL in model.flows
    token_url = scheme.model.flows.password.tokenUrl
    assert token_url == "auth/jwt/login"
