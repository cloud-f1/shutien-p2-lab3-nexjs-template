"""Zeabur Email HTTP API provider (AWS SES backend)."""

import logging

import httpx

from app.services.email.base import EmailProvider, EmailResult

logger = logging.getLogger(__name__)

ZEABUR_API_URL = "https://api.zeabur.com/api/v1/zsend/emails"


class ZeaburProvider(EmailProvider):
    """Send emails via Zeabur Email REST API."""

    def __init__(self, *, api_key: str, from_addr: str) -> None:
        self._api_key = api_key
        self._from_addr = from_addr

    @property
    def name(self) -> str:
        return "zeabur"

    async def send(
        self,
        *,
        to: str,
        subject: str,
        html: str | None = None,
        text: str | None = None,
    ) -> EmailResult:
        payload: dict[str, object] = {
            "from": self._from_addr,
            "to": [to],
            "subject": subject,
        }
        if html:
            payload["html"] = html
        if text:
            payload["text"] = text

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    ZEABUR_API_URL,
                    json=payload,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    timeout=30.0,
                )
                resp.raise_for_status()
                body = resp.json()
                email_id = body.get("email_id", "")
                logger.info("Zeabur email sent to=%s id=%s", to, email_id)
                return EmailResult(success=True, provider=self.name, message_id=email_id)
        except httpx.HTTPStatusError as exc:
            error_msg = f"Zeabur HTTP {exc.response.status_code}: {exc.response.text}"
            logger.error("Zeabur send failed: %s", error_msg)
            return EmailResult(success=False, provider=self.name, error=error_msg)
        except httpx.HTTPError as exc:
            error_msg = f"Zeabur request error: {exc}"
            logger.error("Zeabur send failed: %s", error_msg)
            return EmailResult(success=False, provider=self.name, error=error_msg)
