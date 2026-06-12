"""Email provider package — multi-provider email delivery (Mailgun, Zeabur, Console)."""

from app.services.email.base import EmailProvider, EmailResult
from app.services.email.factory import get_email_provider, reset_email_provider

__all__ = [
    "EmailProvider",
    "EmailResult",
    "get_email_provider",
    "reset_email_provider",
]
