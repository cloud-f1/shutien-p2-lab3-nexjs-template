"""Post schemas for API request/response validation."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class PostCreate(BaseModel):
    title: str = Field(..., max_length=200)
    body: str = Field(..., max_length=10000)
    published: bool = Field(default=False)
    # NOTE: published_at is NOT in PostCreate — server sets it automatically


class PostRead(BaseModel):
    id: uuid.UUID
    title: str
    body: str
    published: bool
    published_at: datetime | None
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PostUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    body: str | None = Field(default=None, max_length=10000)
    published: bool | None = Field(default=None)
