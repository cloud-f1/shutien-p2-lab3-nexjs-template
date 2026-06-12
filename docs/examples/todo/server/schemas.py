"""Task schemas for API request/response validation."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class TaskCreate(BaseModel):
    title: str = Field(..., max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    completed: bool = Field(default=False)
    due_date: datetime | None = Field(default=None)
    priority: int = Field(default=0, ge=0, le=2)


class TaskRead(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    completed: bool
    due_date: datetime | None
    priority: int
    is_overdue: bool = False  # Computed field
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def compute_is_overdue(self) -> "TaskRead":
        """Set is_overdue = True when due_date < now AND not completed."""
        if self.due_date and not self.completed:
            self.is_overdue = self.due_date < datetime.utcnow()
        else:
            self.is_overdue = False
        return self


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    completed: bool | None = Field(default=None)
    due_date: datetime | None = Field(default=None)
    priority: int | None = Field(default=None, ge=0, le=2)


class TaskBatchUpdate(BaseModel):
    """Batch update completion status for multiple tasks."""

    task_ids: list[uuid.UUID] = Field(..., min_length=1, max_length=100)
    completed: bool
