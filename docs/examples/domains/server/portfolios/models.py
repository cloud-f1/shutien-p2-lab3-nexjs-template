"""Portfolio models — investment collections of places."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domains.places.models import Place  # noqa: F401 — used by relationship()
from app.models.base import GUID, Base, TimestampMixin, UUIDMixin


class Portfolio(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "portfolios"

    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True
    )

    portfolio_places: Mapped[list["PortfolioPlace"]] = relationship(
        back_populates="portfolio", cascade="all, delete-orphan", lazy="selectin"
    )

    __table_args__ = (
        CheckConstraint("length(description) <= 2000", name="ck_portfolios_description_len"),
    )


class PortfolioPlace(Base):
    __tablename__ = "portfolio_places"

    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("portfolios.id", ondelete="CASCADE"), primary_key=True
    )
    place_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("places.id", ondelete="CASCADE"), primary_key=True
    )
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    current_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    portfolio: Mapped["Portfolio"] = relationship(back_populates="portfolio_places")
    place: Mapped["Place"] = relationship(lazy="joined")  # cross-domain ref (places)

    __table_args__ = (
        Index("ix_portfolio_places_place_id", "place_id"),
        CheckConstraint("length(notes) <= 1000", name="ck_portfolio_places_notes_len"),
        CheckConstraint("purchase_price >= 0", name="ck_portfolio_places_purchase_price_min"),
        CheckConstraint(
            "purchase_price <= 9999999999.99", name="ck_portfolio_places_purchase_price_max"
        ),
        CheckConstraint("current_value >= 0", name="ck_portfolio_places_current_value_min"),
        CheckConstraint(
            "current_value <= 9999999999.99", name="ck_portfolio_places_current_value_max"
        ),
    )
