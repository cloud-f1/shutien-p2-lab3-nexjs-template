"""Email provider factory — reads EMAIL_PROVIDER env var to select provider."""

import logging

from app.core.config import settings
from app.services.email.base import EmailProvider
from app.services.email.console import ConsoleProvider
from app.services.email.mailgun import MailgunProvider
from app.services.email.zeabur import ZeaburProvider

logger = logging.getLogger(__name__)

_provider_instance: EmailProvider | None = None


def get_email_provider(*, force_new: bool = False) -> EmailProvider:
    """Return the configured email provider (singleton).

    Set force_new=True in tests to bypass the cache.
    """
    global _provider_instance
    if _provider_instance is not None and not force_new:
        return _provider_instance

    provider_name = settings.EMAIL_PROVIDER.lower()

    if provider_name == "mailgun":
        if not settings.MAILGUN_API_KEY or not settings.MAILGUN_DOMAIN:
            raise ValueError(
                "MAILGUN_API_KEY and MAILGUN_DOMAIN must be set when EMAIL_PROVIDER=mailgun"
            )
        _provider_instance = MailgunProvider(
            api_key=settings.MAILGUN_API_KEY,
            domain=settings.MAILGUN_DOMAIN,
            from_addr=settings.EMAIL_FROM,
        )
    elif provider_name == "zeabur":
        if not settings.ZEABUR_EMAIL_API_KEY:
            raise ValueError("ZEABUR_EMAIL_API_KEY must be set when EMAIL_PROVIDER=zeabur")
        _provider_instance = ZeaburProvider(
            api_key=settings.ZEABUR_EMAIL_API_KEY,
            from_addr=settings.EMAIL_FROM,
        )
    elif provider_name == "console":
        _provider_instance = ConsoleProvider()
    else:
        logger.warning("Unknown EMAIL_PROVIDER=%s, falling back to console", provider_name)
        _provider_instance = ConsoleProvider()

    logger.info("Email provider initialized: %s", _provider_instance.name)
    return _provider_instance


def reset_email_provider() -> None:
    """Reset the cached provider (for tests)."""
    global _provider_instance
    _provider_instance = None
