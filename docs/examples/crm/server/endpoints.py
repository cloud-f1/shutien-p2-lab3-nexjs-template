"""Contacts CRUD endpoints + multi-field search."""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_active_user
from app.core.config import settings
from app.core.limiter import limiter
from app.db.session import get_db
from app.domains.contacts.models import Contact
from app.domains.contacts.schemas import ContactCreate, ContactRead, ContactUpdate
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/", response_model=ContactRead, status_code=201)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def create_contact(
    request: Request,
    body: ContactCreate,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    item = Contact(**body.model_dump(), user_id=user.id)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    logger.info(
        "create_contact", extra={"user_id": str(user.id), "contact_id": str(item.id)}
    )
    return item


@router.get("/")
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def list_contacts(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str | None = Query(
        None, max_length=200, description="Search name, email, or company"
    ),
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    base = select(Contact).where(Contact.user_id == user.id)

    # ── CRM-specific: multi-field search ──
    if q:
        search_term = f"%{q}%"
        base = base.where(
            or_(
                Contact.name.ilike(search_term),
                Contact.email.ilike(search_term),
                Contact.company.ilike(search_term),
            )
        )

    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar() or 0

    result = await db.execute(
        base.order_by(Contact.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [ContactRead.model_validate(c) for c in result.scalars().all()]

    pages = (total + page_size - 1) // page_size if total > 0 else 0
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
    }


@router.get("/{contact_id}", response_model=ContactRead)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_contact(
    contact_id: uuid.UUID,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="CONTACT_NOT_FOUND")
    return item


@router.patch("/{contact_id}", response_model=ContactRead)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def update_contact(
    contact_id: uuid.UUID,
    body: ContactUpdate,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="CONTACT_NOT_FOUND")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{contact_id}", status_code=204)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def delete_contact(
    contact_id: uuid.UUID,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="CONTACT_NOT_FOUND")

    await db.delete(item)
    await db.commit()
    return None
