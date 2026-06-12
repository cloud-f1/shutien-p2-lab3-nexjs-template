"""Places CRUD + nearby query endpoints."""

import logging
import uuid
from math import atan2, cos, radians, sin, sqrt

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_active_user
from app.core.config import settings
from app.core.limiter import limiter
from app.db.session import get_db
from app.domains.places.models import Place
from app.domains.places.schemas import PlaceCreate, PlaceRead, PlaceUpdate
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance between two points in km."""
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


@router.post("/", response_model=PlaceRead, status_code=201)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def create_place(
    request: Request,
    body: PlaceCreate,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    place = Place(**body.model_dump(), user_id=user.id)
    db.add(place)
    await db.commit()
    await db.refresh(place)
    logger.info("create_place", extra={"user_id": str(user.id), "place_id": str(place.id)})
    return place


@router.get("/")
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def list_places(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    base = select(Place).where(Place.user_id == user.id)
    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar() or 0

    result = await db.execute(
        base.order_by(Place.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    items = [PlaceRead.model_validate(p) for p in result.scalars().all()]

    pages = (total + page_size - 1) // page_size if total > 0 else 0
    return {"items": items, "total": total, "page": page, "page_size": page_size, "pages": pages}


@router.get("/nearby", response_model=list[PlaceRead])
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def nearby_places(
    request: Request,
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    radius_km: float = Query(10, ge=0, le=100),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    # Bounding-box pre-filter using lat/lng index, then refine with Haversine
    delta_lat = radius_km / 111.0
    delta_lon = radius_km / (111.0 * cos(radians(latitude))) if abs(latitude) < 89.9 else 360.0
    result = await db.execute(
        select(Place).where(
            Place.user_id == user.id,
            Place.latitude.between(latitude - delta_lat, latitude + delta_lat),
            Place.longitude.between(longitude - delta_lon, longitude + delta_lon),
        )
    )
    candidates = result.scalars().all()

    nearby = []
    for p in candidates:
        dist = _haversine_km(latitude, longitude, p.latitude, p.longitude)
        if dist <= radius_km:
            nearby.append((dist, p))

    nearby.sort(key=lambda x: x[0])
    return [p for _, p in nearby[:limit]]


@router.get("/{place_id}", response_model=PlaceRead)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_place(
    place_id: uuid.UUID,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Place).where(Place.id == place_id, Place.user_id == user.id))
    place = result.scalar_one_or_none()
    if place is None:
        raise HTTPException(status_code=404, detail="PLACE_NOT_FOUND")
    return place


@router.patch("/{place_id}", response_model=PlaceRead)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def update_place(
    place_id: uuid.UUID,
    body: PlaceUpdate,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Place).where(Place.id == place_id, Place.user_id == user.id))
    place = result.scalar_one_or_none()
    if place is None:
        raise HTTPException(status_code=404, detail="PLACE_NOT_FOUND")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(place, key, value)

    await db.commit()
    await db.refresh(place)
    return place


@router.delete("/{place_id}", status_code=204)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def delete_place(
    place_id: uuid.UUID,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Place).where(Place.id == place_id, Place.user_id == user.id))
    place = result.scalar_one_or_none()
    if place is None:
        raise HTTPException(status_code=404, detail="PLACE_NOT_FOUND")

    await db.delete(place)
    await db.commit()
    return None
