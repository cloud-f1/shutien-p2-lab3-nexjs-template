import uuid
import logging
from typing import Optional

from fastapi import Depends, Request
from fastapi_users import BaseUserManager, UUIDIDMixin
from fastapi_users.exceptions import InvalidPasswordException

from app.core.audit import log_auth_event
from app.core.config import settings
from app.db.session import get_user_db
from app.models.user import User
from app.services.email import get_email_provider
from app.services.email.template_renderer import html_to_plain_text, render_template

logger = logging.getLogger(__name__)


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = settings.SECRET_KEY
    verification_token_secret = settings.SECRET_KEY
    PASSWORD_MIN_LENGTH = 8

    async def validate_password(self, password: str, user=None) -> None:
        """Enforce minimum password strength."""
        if len(password) < self.PASSWORD_MIN_LENGTH:
            raise InvalidPasswordException(
                reason=f"Password must be at least {self.PASSWORD_MIN_LENGTH} characters"
            )
        if password.isdigit() or password.isalpha():
            raise InvalidPasswordException(reason="Password must contain both letters and numbers")

    def __init__(self, user_db):
        super().__init__(user_db)
        self._email_provider = get_email_provider()

    async def on_after_register(self, user: User, request: Optional[Request] = None):
        logger.info("User %s has registered.", user.id)
        ip = request.client.host if request and request.client else None
        log_auth_event(
            "REGISTER",
            user_id=user.id,
            email=user.email,
            ip=ip,
        )
        # Skip verification if user is already verified (e.g. OAuth with is_verified_by_default)
        if not user.is_verified:
            await self.request_verify(user, request)

    async def on_after_forgot_password(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        ip = request.client.host if request and request.client else None
        log_auth_event(
            "PASSWORD_RESET_REQUEST",
            user_id=user.id,
            email=user.email,
            ip=ip,
        )
        await self._send_email(
            to=user.email,
            token=token,
            subject="Reset your password",
            template="password_reset.html",
        )

    async def on_after_reset_password(self, user: User, request: Optional[Request] = None):
        ip = request.client.host if request and request.client else None
        log_auth_event(
            "PASSWORD_RESET_COMPLETE",
            user_id=user.id,
            ip=ip,
        )

    async def on_after_verify(self, user: User, request: Optional[Request] = None):
        ip = request.client.host if request and request.client else None
        log_auth_event(
            "EMAIL_VERIFIED",
            user_id=user.id,
            email=user.email,
            ip=ip,
        )

    async def on_after_request_verify(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        await self._send_email(
            to=user.email,
            token=token,
            subject="Verify your email",
            template="verification.html",
        )

    async def _send_email(self, *, to: str, token: str, subject: str, template: str) -> None:
        """Render template and send via configured email provider."""
        import app.services.email.console as _console_mod

        if settings.ENVIRONMENT != "production":
            _console_mod._last_token = token
            _console_mod._last_token_email = to

        # Build link based on template name
        if "verification" in template:
            path = "verify-email"
        else:
            path = "reset-password"
        link = f"{settings.ALLOWED_ORIGINS[0]}/{path}?token={token}"

        html = render_template(template, link=link)
        text = html_to_plain_text(html)
        await self._email_provider.send(to=to, subject=subject, html=html, text=text)


async def get_user_manager(user_db=Depends(get_user_db)):
    yield UserManager(user_db)
