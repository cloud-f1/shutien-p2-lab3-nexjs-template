"""Portfolio CRUD, membership, and analytics endpoints."""

import logging
import uuid
from collections import defaultdict
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_active_user
from app.core.config import settings
from app.core.limiter import limiter
from app.db.session import get_db
from app.domains.places.models import Place
from app.domains.portfolios.models import Portfolio, PortfolioPlace
from app.domains.portfolios.schemas import (
    CategoryAllocation,
    PortfolioAnalytics,
    PortfolioCreate,
    PortfolioDetail,
    PortfolioPlaceCreate,
    PortfolioPlaceRead,
    PortfolioPlaceUpdate,
    PortfolioRead,
    PortfolioUpdate,
    TopPerformer,
)
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_portfolio_or_404(portfolio_id: uuid.UUID, user: User, db: AsyncSession) -> Portfolio:
    result = await db.execute(
        select(Portfolio).where(Portfolio.id == portfolio_id, Portfolio.user_id == user.id)
    )
    portfolio = result.scalar_one_or_none()
    if portfolio is None:
        raise HTTPException(status_code=404, detail="PORTFOLIO_NOT_FOUND")
    return portfolio


def _portfolio_summary(portfolio: Portfolio) -> dict:
    """Compute place_count and total_value from loaded portfolio_places."""
    places = portfolio.portfolio_places or []
    return {
        "place_count": len(places),
        "total_value": sum((pp.current_value for pp in places), Decimal("0.00")),
    }


def _to_portfolio_read(portfolio: Portfolio) -> PortfolioRead:
    summary = _portfolio_summary(portfolio)
    return PortfolioRead(
        id=portfolio.id,
        name=portfolio.name,
        description=portfolio.description,
        user_id=portfolio.user_id,
        place_count=summary["place_count"],
        total_value=summary["total_value"],
        created_at=portfolio.created_at,
        updated_at=portfolio.updated_at,
    )


def _pp_gain_loss(pp: PortfolioPlace) -> Decimal:
    return pp.current_value - pp.purchase_price


def _to_pp_read(pp: PortfolioPlace) -> PortfolioPlaceRead:
    return PortfolioPlaceRead(
        portfolio_id=pp.portfolio_id,
        place_id=pp.place_id,
        purchase_price=pp.purchase_price,
        current_value=pp.current_value,
        gain_loss=_pp_gain_loss(pp),
        notes=pp.notes,
        added_at=pp.added_at,
        place=pp.place,
    )


# ---------------------------------------------------------------------------
# Portfolio CRUD
# ---------------------------------------------------------------------------


@router.post("/", response_model=PortfolioRead, status_code=201)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def create_portfolio(
    request: Request,
    body: PortfolioCreate,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    portfolio = Portfolio(**body.model_dump(), user_id=user.id)
    db.add(portfolio)
    await db.commit()
    await db.refresh(portfolio)
    logger.info(
        "create_portfolio", extra={"user_id": str(user.id), "portfolio_id": str(portfolio.id)}
    )
    return _to_portfolio_read(portfolio)


@router.get("/")
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def list_portfolios(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    base = select(Portfolio).where(Portfolio.user_id == user.id)
    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar() or 0

    result = await db.execute(
        base.order_by(Portfolio.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    items = [_to_portfolio_read(p) for p in result.scalars().all()]

    pages = (total + page_size - 1) // page_size if total > 0 else 0
    return {"items": items, "total": total, "page": page, "page_size": page_size, "pages": pages}


@router.get("/{portfolio_id}", response_model=PortfolioDetail)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_portfolio(
    portfolio_id: uuid.UUID,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    portfolio = await _get_portfolio_or_404(portfolio_id, user, db)
    pp_list = portfolio.portfolio_places or []
    total_value = sum((pp.current_value for pp in pp_list), Decimal("0.00"))
    total_purchase = sum((pp.purchase_price for pp in pp_list), Decimal("0.00"))
    gain_loss = total_value - total_purchase
    gain_loss_pct = (gain_loss / total_purchase * Decimal("100")) if total_purchase > 0 else None

    return PortfolioDetail(
        id=portfolio.id,
        name=portfolio.name,
        description=portfolio.description,
        user_id=portfolio.user_id,
        place_count=len(pp_list),
        total_value=total_value,
        total_purchase=total_purchase,
        gain_loss=gain_loss,
        gain_loss_pct=gain_loss_pct,
        places=[_to_pp_read(pp) for pp in pp_list],
        created_at=portfolio.created_at,
        updated_at=portfolio.updated_at,
    )


@router.patch("/{portfolio_id}", response_model=PortfolioRead)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def update_portfolio(
    portfolio_id: uuid.UUID,
    body: PortfolioUpdate,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    portfolio = await _get_portfolio_or_404(portfolio_id, user, db)
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(portfolio, key, value)
    await db.commit()
    await db.refresh(portfolio)
    return _to_portfolio_read(portfolio)


@router.delete("/{portfolio_id}", status_code=204)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def delete_portfolio(
    portfolio_id: uuid.UUID,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    portfolio = await _get_portfolio_or_404(portfolio_id, user, db)
    await db.delete(portfolio)
    await db.commit()
    return None


# ---------------------------------------------------------------------------
# Portfolio <-> Place membership
# ---------------------------------------------------------------------------


@router.post("/{portfolio_id}/places", response_model=PortfolioPlaceRead, status_code=201)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def add_place_to_portfolio(
    portfolio_id: uuid.UUID,
    body: PortfolioPlaceCreate,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    portfolio = await _get_portfolio_or_404(portfolio_id, user, db)

    # Verify place belongs to user
    place_result = await db.execute(
        select(Place).where(Place.id == body.place_id, Place.user_id == user.id)
    )
    place = place_result.scalar_one_or_none()
    if place is None:
        raise HTTPException(status_code=404, detail="PLACE_NOT_FOUND")

    # Check duplicate
    existing = await db.execute(
        select(PortfolioPlace).where(
            PortfolioPlace.portfolio_id == portfolio.id,
            PortfolioPlace.place_id == body.place_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="PLACE_ALREADY_IN_PORTFOLIO")

    pp = PortfolioPlace(
        portfolio_id=portfolio.id,
        place_id=body.place_id,
        purchase_price=body.purchase_price,
        current_value=body.current_value,
        notes=body.notes,
    )
    db.add(pp)
    await db.commit()
    await db.refresh(pp)
    return _to_pp_read(pp)


@router.get("/{portfolio_id}/places", response_model=list[PortfolioPlaceRead])
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def list_portfolio_places(
    portfolio_id: uuid.UUID,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    portfolio = await _get_portfolio_or_404(portfolio_id, user, db)
    return [_to_pp_read(pp) for pp in (portfolio.portfolio_places or [])]


@router.patch("/{portfolio_id}/places/{place_id}", response_model=PortfolioPlaceRead)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def update_portfolio_place(
    portfolio_id: uuid.UUID,
    place_id: uuid.UUID,
    body: PortfolioPlaceUpdate,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_portfolio_or_404(portfolio_id, user, db)
    result = await db.execute(
        select(PortfolioPlace).where(
            PortfolioPlace.portfolio_id == portfolio_id,
            PortfolioPlace.place_id == place_id,
        )
    )
    pp = result.scalar_one_or_none()
    if pp is None:
        raise HTTPException(status_code=404, detail="PORTFOLIO_PLACE_NOT_FOUND")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(pp, key, value)
    await db.commit()
    await db.refresh(pp)
    return _to_pp_read(pp)


@router.delete("/{portfolio_id}/places/{place_id}", status_code=204)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def remove_portfolio_place(
    portfolio_id: uuid.UUID,
    place_id: uuid.UUID,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_portfolio_or_404(portfolio_id, user, db)
    result = await db.execute(
        select(PortfolioPlace).where(
            PortfolioPlace.portfolio_id == portfolio_id,
            PortfolioPlace.place_id == place_id,
        )
    )
    pp = result.scalar_one_or_none()
    if pp is None:
        raise HTTPException(status_code=404, detail="PORTFOLIO_PLACE_NOT_FOUND")

    await db.delete(pp)
    await db.commit()
    return None


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------


@router.get("/{portfolio_id}/analytics", response_model=PortfolioAnalytics)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_portfolio_analytics(
    portfolio_id: uuid.UUID,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    portfolio = await _get_portfolio_or_404(portfolio_id, user, db)
    pp_list = portfolio.portfolio_places or []

    total_value = sum((pp.current_value for pp in pp_list), Decimal("0.00"))
    total_purchase = sum((pp.purchase_price for pp in pp_list), Decimal("0.00"))
    gain_loss = total_value - total_purchase
    gain_loss_pct = (gain_loss / total_purchase * Decimal("100")) if total_purchase > 0 else None

    # Category allocation
    cat_data: dict[str, dict] = defaultdict(lambda: {"count": 0, "value": Decimal("0.00")})
    for pp in pp_list:
        cat = pp.place.category or "uncategorized"
        cat_data[cat]["count"] += 1
        cat_data[cat]["value"] += pp.current_value

    category_allocation = [
        CategoryAllocation(
            category=cat,
            count=data["count"],
            value=data["value"],
            percentage=(
                (data["value"] / total_value * Decimal("100")) if total_value > 0 else Decimal("0")
            ),
        )
        for cat, data in sorted(cat_data.items())
    ]

    # Top performers (sorted by gain_loss descending, limit 10)
    performers = []
    for pp in pp_list:
        gl = pp.current_value - pp.purchase_price
        gl_pct = (gl / pp.purchase_price * Decimal("100")) if pp.purchase_price > 0 else None
        performers.append(
            TopPerformer(
                place_id=pp.place_id,
                place_name=pp.place.name,
                purchase_price=pp.purchase_price,
                current_value=pp.current_value,
                gain_loss=gl,
                gain_loss_pct=gl_pct,
            )
        )
    performers.sort(key=lambda x: x.gain_loss, reverse=True)

    return PortfolioAnalytics(
        portfolio_id=portfolio.id,
        total_value=total_value,
        total_purchase=total_purchase,
        gain_loss=gain_loss,
        gain_loss_pct=gain_loss_pct,
        place_count=len(pp_list),
        category_allocation=category_allocation,
        top_performers=performers[:10],
    )
