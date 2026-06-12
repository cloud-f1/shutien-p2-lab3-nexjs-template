"""Session read schema for API responses."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class SessionRead(BaseModel):
    id: uuid.UUID
    device_info: str
    ip_address: str | None
    created_at: datetime
    last_used_at: datetime
    expires_at: datetime
    is_current: bool

    model_config = {"from_attributes": True}
