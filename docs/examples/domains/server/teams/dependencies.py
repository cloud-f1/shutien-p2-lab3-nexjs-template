"""RBAC dependencies for team endpoints."""

import uuid

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_active_user
from app.db.session import get_db
from app.domains.teams.models import Role, TeamMember, role_gte
from app.models.user import User


async def get_team_membership(
    team_id: uuid.UUID,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
) -> TeamMember:
    """Get user's membership in a team. Raises 403 if not a member.

    Superuser bypasses and gets a synthetic owner membership.
    """
    if user.is_superuser:
        # Synthetic owner membership for superusers
        synthetic = TeamMember(
            team_id=team_id,
            user_id=user.id,
            role=Role.owner.value,
        )
        synthetic.user = user
        return synthetic

    result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user.id,
        )
    )
    member = result.unique().scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=403, detail="NOT_A_TEAM_MEMBER")
    return member


def require_role(min_role: Role):
    """Factory that returns a FastAPI dependency checking minimum role.

    Usage: member = Depends(require_role(Role.admin))
    """

    async def _check(
        member: TeamMember = Depends(get_team_membership),
    ) -> TeamMember:
        user_role = Role(member.role)
        if not role_gte(user_role, min_role):
            raise HTTPException(
                status_code=403,
                detail=f"INSUFFICIENT_ROLE: requires {min_role.value} or higher",
            )
        return member

    return _check
