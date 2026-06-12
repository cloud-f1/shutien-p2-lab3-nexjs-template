"""Abstract base class for email providers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class EmailResult:
    """Result of an email send attempt."""

    success: bool
    provider: str
    message_id: str | None = None
    error: str | None = None


class EmailProvider(ABC):
    """Abstract email provider interface."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name for logging."""
        ...

    @abstractmethod
    async def send(
        self,
        *,
        to: str,
        subject: str,
        html: str | None = None,
        text: str | None = None,
    ) -> EmailResult:
        """Send an email. At least one of html or text must be provided."""
        ...
