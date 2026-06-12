"""Portfolio schemas for API request/response validation."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field, PlainSerializer

from app.domains.places.schemas import PlaceRead

# Reusable annotated type: Decimal serialized as string with 2 decimal places
DecimalStr = Annotated[
    Decimal,
    PlainSerializer(lambda v: str(v.quantize(Decimal("0.01"))), return_type=str),
]

# Nullable variant for percentages that may be None
NullableDecimalStr = Annotated[
    Decimal | None,
    PlainSerializer(
        lambda v: str(v.quantize(Decimal("0.01"))) if v is not None else None,
        return_type=str | None,
    ),
]

_MAX_MONETARY = Decimal("9999999999.99")


class PortfolioCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class PortfolioRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    user_id: uuid.UUID
    place_count: int
    total_value: DecimalStr
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PortfolioUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class PortfolioPlaceCreate(BaseModel):
    place_id: uuid.UUID
    purchase_price: Decimal = Field(
        default=Decimal("0.00"), ge=0, le=_MAX_MONETARY, decimal_places=2
    )
    current_value: Decimal = Field(
        default=Decimal("0.00"), ge=0, le=_MAX_MONETARY, decimal_places=2
    )
    notes: str | None = Field(default=None, max_length=1000)


class PortfolioPlaceRead(BaseModel):
    portfolio_id: uuid.UUID
    place_id: uuid.UUID
    purchase_price: DecimalStr
    current_value: DecimalStr
    gain_loss: DecimalStr
    notes: str | None
    added_at: datetime
    place: PlaceRead

    model_config = {"from_attributes": True}


class PortfolioPlaceUpdate(BaseModel):
    purchase_price: Decimal | None = Field(default=None, ge=0, le=_MAX_MONETARY, decimal_places=2)
    current_value: Decimal | None = Field(default=None, ge=0, le=_MAX_MONETARY, decimal_places=2)
    notes: str | None = Field(default=None, max_length=1000)


class PortfolioDetail(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    user_id: uuid.UUID
    place_count: int
    total_value: DecimalStr
    total_purchase: DecimalStr
    gain_loss: DecimalStr
    gain_loss_pct: NullableDecimalStr
    places: list[PortfolioPlaceRead]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CategoryAllocation(BaseModel):
    category: str
    count: int
    value: DecimalStr
    percentage: DecimalStr


class TopPerformer(BaseModel):
    place_id: uuid.UUID
    place_name: str
    purchase_price: DecimalStr
    current_value: DecimalStr
    gain_loss: DecimalStr
    gain_loss_pct: NullableDecimalStr


class PortfolioAnalytics(BaseModel):
    portfolio_id: uuid.UUID
    total_value: DecimalStr
    total_purchase: DecimalStr
    gain_loss: DecimalStr
    gain_loss_pct: NullableDecimalStr
    place_count: int
    category_allocation: list[CategoryAllocation]
    top_performers: list[TopPerformer]
