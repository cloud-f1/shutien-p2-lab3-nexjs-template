"""Posts CRUD endpoints."""

import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_active_user
from app.core.config import settings
from app.core.limiter import limiter
from app.db.session import get_db
from app.domains.posts.models import Post
from app.domains.posts.schemas import PostCreate, PostRead, PostUpdate
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/", response_model=PostRead, status_code=201)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def create_post(
    request: Request,
    body: PostCreate,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump()
    # Auto-set published_at when creating as published
    if data.get("published"):
        data["published_at"] = datetime.utcnow()
    item = Post(**data, user_id=user.id)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    logger.info("create_post", extra={"user_id": str(user.id), "post_id": str(item.id)})
    return item


@router.get("/")
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def list_posts(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    published: bool | None = Query(None, description="Filter by publish status"),
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    base = select(Post).where(Post.user_id == user.id)

    # ── Blog-specific: published filter ──
    if published is not None:
        base = base.where(Post.published == published)

    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar() or 0

    result = await db.execute(
        base.order_by(Post.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [PostRead.model_validate(p) for p in result.scalars().all()]

    pages = (total + page_size - 1) // page_size if total > 0 else 0
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
    }


@router.get("/{post_id}", response_model=PostRead)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_post(
    post_id: uuid.UUID,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Post).where(Post.id == post_id, Post.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="POST_NOT_FOUND")
    return item


@router.patch("/{post_id}", response_model=PostRead)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def update_post(
    post_id: uuid.UUID,
    body: PostUpdate,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Post).where(Post.id == post_id, Post.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="POST_NOT_FOUND")

    update_data = body.model_dump(exclude_unset=True)

    # ── Blog-specific: auto-set published_at on first publish ──
    if update_data.get("published") and not item.published_at:
        update_data["published_at"] = datetime.utcnow()

    for key, value in update_data.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{post_id}", status_code=204)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def delete_post(
    post_id: uuid.UUID,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Post).where(Post.id == post_id, Post.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="POST_NOT_FOUND")

    await db.delete(item)
    await db.commit()
    return None
