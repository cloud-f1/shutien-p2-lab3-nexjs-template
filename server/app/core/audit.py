"""Structured audit logging for security-relevant events."""

import logging
import uuid
from datetime import datetime, timezone

from app.middleware.correlation import correlation_id_var

audit_logger = logging.getLogger("audit")


def log_auth_event(
    event: str,
    *,
    user_id: uuid.UUID | None = None,
    email: str | None = None,
    ip: str | None = None,
    success: bool = True,
    detail: str | None = None,
) -> None:
    """Emit a structured audit log entry for an auth event."""
    audit_logger.info(
        "auth_event",
        extra={
            "event": event,
            "user_id": str(user_id) if user_id else None,
            "email": email,
            "ip": ip,
            "success": success,
            "detail": detail,
            "correlation_id": correlation_id_var.get(""),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
