import uuid

import jwt as pyjwt
from fastapi_users import FastAPIUsers, exceptions, models
from fastapi_users.authentication import AuthenticationBackend, BearerTransport, JWTStrategy
from fastapi_users.jwt import decode_jwt
from fastapi_users.manager import BaseUserManager

from app.core.config import settings
from app.models.user import User
from app.services.user_manager import get_user_manager

bearer_transport = BearerTransport(tokenUrl="auth/jwt/login")


class RotatingJWTStrategy(JWTStrategy):  # type: ignore[type-arg]
    """JWTStrategy that falls back to a previous secret on InvalidSignatureError.

    This enables zero-downtime secret rotation: deploy the new secret while
    keeping the old one in ``SECRET_KEY_PREVIOUS`` until all existing tokens
    expire.
    """

    def __init__(self, *args, previous_secret: str = "", **kwargs):  # type: ignore[no-untyped-def]
        super().__init__(*args, **kwargs)
        self.previous_secret = previous_secret

    async def read_token(
        self,
        token: str | None,
        user_manager: BaseUserManager[models.UP, models.ID],
    ) -> models.UP | None:
        if token is None:
            return None

        try:
            data = decode_jwt(
                token, self.decode_key, self.token_audience, algorithms=[self.algorithm]
            )
        except pyjwt.InvalidSignatureError:
            if not self.previous_secret:
                return None
            try:
                data = decode_jwt(
                    token,
                    self.previous_secret,
                    self.token_audience,
                    algorithms=[self.algorithm],
                )
            except pyjwt.PyJWTError:
                return None
        except pyjwt.PyJWTError:
            return None

        user_id = data.get("sub")
        if user_id is None:
            return None

        try:
            parsed_id = user_manager.parse_id(user_id)
            return await user_manager.get(parsed_id)
        except (exceptions.UserNotExists, exceptions.InvalidID):
            return None


def get_jwt_strategy() -> RotatingJWTStrategy:
    return RotatingJWTStrategy(
        secret=settings.SECRET_KEY,
        lifetime_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        previous_secret=settings.SECRET_KEY_PREVIOUS,
    )


auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

current_active_user = fastapi_users.current_user(active=True)
