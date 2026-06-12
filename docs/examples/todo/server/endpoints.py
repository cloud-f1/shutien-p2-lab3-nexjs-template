"""Tasks CRUD endpoints + batch update."""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_active_user
from app.core.config import settings
from app.core.limiter import limiter
from app.db.session import get_db
from app.domains.tasks.models import Task
from app.domains.tasks.schemas import TaskBatchUpdate, TaskCreate, TaskRead, TaskUpdate
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/", response_model=TaskRead, status_code=201)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def create_task(
    request: Request,
    body: TaskCreate,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    item = Task(**body.model_dump(), user_id=user.id)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    logger.info("create_task", extra={"user_id": str(user.id), "task_id": str(item.id)})
    return item


@router.get("/")
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def list_tasks(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    completed: bool | None = Query(None, description="Filter by completion status"),
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    base = select(Task).where(Task.user_id == user.id)

    # ── Todo-specific: completed filter ──
    if completed is not None:
        base = base.where(Task.completed == completed)

    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar() or 0

    # ── Todo-specific: priority DESC, due_date ASC sorting ──
    result = await db.execute(
        base.order_by(Task.priority.desc(), Task.due_date.asc().nullslast())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [TaskRead.model_validate(t) for t in result.scalars().all()]

    pages = (total + page_size - 1) // page_size if total > 0 else 0
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
    }


@router.get("/{task_id}", response_model=TaskRead)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_task(
    task_id: uuid.UUID,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="TASK_NOT_FOUND")
    return item


@router.patch("/{task_id}", response_model=TaskRead)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def update_task(
    task_id: uuid.UUID,
    body: TaskUpdate,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="TASK_NOT_FOUND")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{task_id}", status_code=204)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def delete_task(
    task_id: uuid.UUID,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="TASK_NOT_FOUND")

    await db.delete(item)
    await db.commit()
    return None


# ── Todo-specific: batch update endpoint ──
@router.patch("/batch")
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def batch_update_tasks(
    request: Request,
    body: TaskBatchUpdate,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Batch update completion status for multiple tasks owned by the user."""
    result = await db.execute(
        update(Task)
        .where(Task.id.in_(body.task_ids), Task.user_id == user.id)
        .values(completed=body.completed)
    )
    await db.commit()
    updated = result.rowcount
    logger.info(
        "batch_update_tasks",
        extra={
            "user_id": str(user.id),
            "updated": updated,
            "completed": body.completed,
        },
    )
    return {"updated": updated}
