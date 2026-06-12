"""Console email provider — logs emails for development."""

import logging
import uuid

from app.services.email.base import EmailProvider, EmailResult

logger = logging.getLogger(__name__)

# Dev-only: last token captured for E2E test extraction
_last_token: str | None = None
_last_token_email: str | None = None


class ConsoleProvider(EmailProvider):
    """Logs emails to console. Default provider for development."""

    @property
    def name(self) -> str:
        return "console"

    async def send(
        self,
        *,
        to: str,
        subject: str,
        html: str | None = None,
        text: str | None = None,
    ) -> EmailResult:
        message_id = f"console-{uuid.uuid4().hex[:8]}"
        logger.info(
            "EMAIL [%s] to=%s subject=%s\n--- body ---\n%s\n--- end ---",
            message_id,
            to,
            subject,
            text or html or "(empty)",
        )
        return EmailResult(success=True, provider=self.name, message_id=message_id)
