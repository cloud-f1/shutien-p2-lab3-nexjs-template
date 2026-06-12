"""Billing Pydantic schemas — derived from OpenAPI spec."""

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class SubscriptionStatus(str, Enum):
    active = "active"
    past_due = "past_due"
    canceled = "canceled"
    incomplete = "incomplete"
    trialing = "trialing"
    unpaid = "unpaid"
    paused = "paused"
    free = "free"


class PlanRead(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    stripe_price_id: str | None = None
    amount: int
    currency: str = "usd"
    interval: str = "month"
    features: dict = Field(default_factory=dict)
    limits: dict | None = None
    is_active: bool = True
    display_order: int = 0

    model_config = {"from_attributes": True}


class SubscriptionRead(BaseModel):
    id: uuid.UUID | None = None
    team_id: uuid.UUID
    status: SubscriptionStatus
    plan: PlanRead
    stripe_subscription_id: str | None = None
    stripe_customer_id: str | None = None
    current_period_start: datetime | None = None
    current_period_end: datetime | None = None
    cancel_at_period_end: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class CheckoutSessionCreate(BaseModel):
    team_id: uuid.UUID
    plan_id: uuid.UUID
    success_url: str | None = None
    cancel_url: str | None = None


class CheckoutSessionRead(BaseModel):
    checkout_url: str
    session_id: str


class PortalSessionCreate(BaseModel):
    team_id: uuid.UUID
    return_url: str | None = None


class PortalSessionRead(BaseModel):
    portal_url: str
