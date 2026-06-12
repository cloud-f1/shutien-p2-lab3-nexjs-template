"""Team schemas for API request/response validation."""

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class TeamRole(str, Enum):
    viewer = "viewer"
    editor = "editor"
    admin = "admin"
    owner = "owner"


class TeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str | None = Field(
        default=None,
        max_length=100,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )


class TeamRead(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    member_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TeamReadWithRole(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    member_count: int
    my_role: TeamRole
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TeamUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    slug: str | None = Field(
        default=None,
        max_length=100,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )


class TeamMemberCreate(BaseModel):
    user_id: uuid.UUID
    role: TeamRole


class TeamMemberUserSummary(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str | None = None
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


class TeamMemberRead(BaseModel):
    id: uuid.UUID
    team_id: uuid.UUID
    user_id: uuid.UUID
    role: TeamRole
    user: TeamMemberUserSummary
    created_at: datetime

    model_config = {"from_attributes": True}


class TeamMemberUpdate(BaseModel):
    role: TeamRole
