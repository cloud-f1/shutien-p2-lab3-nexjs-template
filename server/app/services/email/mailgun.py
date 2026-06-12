"""Mailgun HTTP API email provider."""

import logging

import httpx

from app.services.email.base import EmailProvider, EmailResult

logger = logging.getLogger(__name__)

MAILGUN_API_BASE = "https://api.mailgun.net/v3"


class MailgunProvider(EmailProvider):
    """Send emails via Mailgun HTTP API."""

    def __init__(self, *, api_key: str, domain: str, from_addr: str) -> None:
        self._api_key = api_key
        self._domain = domain
        self._from_addr = from_addr

    @property
    def name(self) -> str:
        return "mailgun"

    async def send(
        self,
        *,
        to: str,
        subject: str,
        html: str | None = None,
        text: str | None = None,
    ) -> EmailResult:
        url = f"{MAILGUN_API_BASE}/{self._domain}/messages"
        data: dict[str, str] = {
            "from": self._from_addr,
            "to": to,
            "subject": subject,
        }
        if html:
            data["html"] = html
        if text:
            data["text"] = text

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    url,
                    auth=("api", self._api_key),
                    data=data,
                    timeout=30.0,
                )
                resp.raise_for_status()
                body = resp.json()
                message_id = body.get("id", "")
                logger.info("Mailgun sent to=%s id=%s", to, message_id)
                return EmailResult(success=True, provider=self.name, message_id=message_id)
        except httpx.HTTPStatusError as exc:
            error_msg = f"Mailgun HTTP {exc.response.status_code}: {exc.response.text}"
            logger.error("Mailgun send failed: %s", error_msg)
            return EmailResult(success=False, provider=self.name, error=error_msg)
        except httpx.HTTPError as exc:
            error_msg = f"Mailgun request error: {exc}"
            logger.error("Mailgun send failed: %s", error_msg)
            return EmailResult(success=False, provider=self.name, error=error_msg)
