"""Contact schemas for API request/response validation."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator


class ContactCreate(BaseModel):
    name: str = Field(..., max_length=200)
    email: EmailStr | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=20)
    company: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)


class ContactRead(BaseModel):
    id: uuid.UUID
    name: str
    email: str | None
    phone: str | None
    company: str | None
    notes: str | None
    notes_preview: str | None = None  # Computed: truncated notes for list view
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def compute_notes_preview(self) -> "ContactRead":
        """Truncate notes to 200 chars for list view."""
        if self.notes and len(self.notes) > 200:
            self.notes_preview = self.notes[:200] + "..."
        else:
            self.notes_preview = self.notes
        return self


class ContactUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    email: EmailStr | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=20)
    company: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)
