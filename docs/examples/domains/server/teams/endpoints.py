"""Teams CRUD + member management endpoints."""

import logging
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_active_user
from app.core.config import settings
from app.core.limiter import limiter
from app.db.session import get_db
from app.domains.teams.dependencies import get_team_membership, require_role
from app.domains.teams.models import Role, Team, TeamMember
from app.domains.teams.schemas import (
    TeamCreate,
    TeamMemberCreate,
    TeamMemberRead,
    TeamMemberUpdate,
    TeamRead,
    TeamReadWithRole,
    TeamUpdate,
)
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


def _slugify(name: str) -> str:
    """Generate a URL-safe slug from a team name."""
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug or "team"


async def _team_to_read(team: Team, db: AsyncSession) -> TeamRead:
    """Convert a Team model to TeamRead schema with member count."""
    from sqlalchemy import func as sa_func

    count_result = await db.execute(
        select(sa_func.count(TeamMember.id)).where(TeamMember.team_id == team.id)
    )
    member_count = count_result.scalar() or 0
    return TeamRead(
        id=team.id,
        name=team.name,
        slug=team.slug,
        member_count=member_count,
        created_at=team.created_at,
        updated_at=team.updated_at,
    )


@router.post("/", response_model=TeamRead, status_code=201)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def create_team(
    request: Request,
    body: TeamCreate,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    slug = body.slug or _slugify(body.name)

    # Check slug uniqueness
    existing = await db.execute(select(Team).where(Team.slug == slug))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="TEAM_SLUG_EXISTS")

    team = Team(name=body.name, slug=slug)
    db.add(team)
    await db.flush()  # Get team.id before creating member

    # Creator becomes owner
    member = TeamMember(team_id=team.id, user_id=user.id, role=Role.owner.value)
    db.add(member)
    await db.commit()
    await db.refresh(team)

    logger.info("create_team", extra={"user_id": str(user.id), "team_id": str(team.id)})
    return await _team_to_read(team, db)


@router.get("/", response_model=list[TeamReadWithRole])
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def list_teams(
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func as sa_func

    # Subquery: member count per team
    member_count_sq = (
        select(
            TeamMember.team_id,
            sa_func.count(TeamMember.id).label("member_count"),
        )
        .group_by(TeamMember.team_id)
        .subquery()
    )

    # Join: my memberships → team → member count
    stmt = (
        select(
            Team,
            TeamMember.role,
            member_count_sq.c.member_count,
        )
        .join(TeamMember, TeamMember.team_id == Team.id)
        .outerjoin(member_count_sq, member_count_sq.c.team_id == Team.id)
        .where(TeamMember.user_id == user.id)
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        TeamReadWithRole(
            id=team.id,
            name=team.name,
            slug=team.slug,
            member_count=count or 0,
            my_role=role,
            created_at=team.created_at,
            updated_at=team.updated_at,
        )
        for team, role, count in rows
    ]


@router.get("/{team_id}", response_model=TeamRead)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_team(
    team_id: uuid.UUID,
    request: Request,
    member: TeamMember = Depends(get_team_membership),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if team is None:
        raise HTTPException(status_code=404, detail="TEAM_NOT_FOUND")
    return await _team_to_read(team, db)


@router.patch("/{team_id}", response_model=TeamRead)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def update_team(
    team_id: uuid.UUID,
    body: TeamUpdate,
    request: Request,
    member: TeamMember = Depends(require_role(Role.admin)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if team is None:
        raise HTTPException(status_code=404, detail="TEAM_NOT_FOUND")

    update_data = body.model_dump(exclude_unset=True)

    # Check slug uniqueness if changing
    if "slug" in update_data and update_data["slug"] != team.slug:
        existing = await db.execute(select(Team).where(Team.slug == update_data["slug"]))
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=409, detail="TEAM_SLUG_EXISTS")

    for key, value in update_data.items():
        setattr(team, key, value)

    await db.commit()
    await db.refresh(team)
    return await _team_to_read(team, db)


@router.delete("/{team_id}", status_code=204)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def delete_team(
    team_id: uuid.UUID,
    request: Request,
    member: TeamMember = Depends(require_role(Role.owner)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if team is None:
        raise HTTPException(status_code=404, detail="TEAM_NOT_FOUND")

    await db.delete(team)
    await db.commit()
    return None


@router.get("/{team_id}/members", response_model=list[TeamMemberRead])
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def list_members(
    team_id: uuid.UUID,
    request: Request,
    member: TeamMember = Depends(get_team_membership),
    db: AsyncSession = Depends(get_db),
):
    # Verify team exists
    team_result = await db.execute(select(Team).where(Team.id == team_id))
    if team_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="TEAM_NOT_FOUND")

    result = await db.execute(select(TeamMember).where(TeamMember.team_id == team_id))
    members = result.unique().scalars().all()
    return [TeamMemberRead.model_validate(m) for m in members]


@router.post("/{team_id}/members", response_model=TeamMemberRead, status_code=201)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def add_member(
    team_id: uuid.UUID,
    body: TeamMemberCreate,
    request: Request,
    member: TeamMember = Depends(require_role(Role.admin)),
    db: AsyncSession = Depends(get_db),
):
    # Verify team exists
    team_result = await db.execute(select(Team).where(Team.id == team_id))
    if team_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="TEAM_NOT_FOUND")

    # Verify target user exists
    from app.models.user import User

    user_result = await db.execute(select(User).where(User.id == body.user_id))
    target_user = user_result.unique().scalar_one_or_none()
    if target_user is None:
        raise HTTPException(status_code=404, detail="USER_NOT_FOUND")

    # Check for existing membership
    existing = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == body.user_id,
        )
    )
    if existing.unique().scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="MEMBER_ALREADY_EXISTS")

    # Cannot add someone as owner
    if body.role.value == Role.owner.value:
        raise HTTPException(status_code=403, detail="CANNOT_ASSIGN_OWNER_ROLE")

    new_member = TeamMember(team_id=team_id, user_id=body.user_id, role=body.role.value)
    db.add(new_member)
    await db.commit()
    await db.refresh(new_member)

    logger.info(
        "add_member",
        extra={
            "team_id": str(team_id),
            "user_id": str(body.user_id),
            "role": body.role.value,
        },
    )
    return TeamMemberRead.model_validate(new_member)


@router.patch("/{team_id}/members/{user_id}", response_model=TeamMemberRead)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def update_member(
    team_id: uuid.UUID,
    user_id: uuid.UUID,
    body: TeamMemberUpdate,
    request: Request,
    member: TeamMember = Depends(require_role(Role.admin)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
        )
    )
    target = result.unique().scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="MEMBER_NOT_FOUND")

    # Cannot change owner's role
    if target.role == Role.owner.value:
        raise HTTPException(status_code=403, detail="CANNOT_CHANGE_OWNER_ROLE")

    # Cannot promote to owner
    if body.role.value == Role.owner.value:
        raise HTTPException(status_code=403, detail="CANNOT_ASSIGN_OWNER_ROLE")

    target.role = body.role.value
    await db.commit()
    await db.refresh(target)
    return TeamMemberRead.model_validate(target)


@router.delete("/{team_id}/members/{user_id}", status_code=204)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def remove_member(
    team_id: uuid.UUID,
    user_id: uuid.UUID,
    request: Request,
    member: TeamMember = Depends(require_role(Role.admin)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
        )
    )
    target = result.unique().scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="MEMBER_NOT_FOUND")

    # Cannot remove the owner
    if target.role == Role.owner.value:
        raise HTTPException(status_code=403, detail="CANNOT_REMOVE_OWNER")

    await db.delete(target)
    await db.commit()
    return None
