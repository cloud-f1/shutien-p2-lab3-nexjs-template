"""Teams domain — RBAC team management with role hierarchy."""

from app.domains import DomainConfig
from app.domains.teams.endpoints import router
from app.domains.teams.models import Team, TeamMember

domain_config = DomainConfig(
    router=router,
    prefix="/teams",
    tags=["teams"],
    models=[Team, TeamMember],
)

__all__ = ["domain_config", "Team", "TeamMember"]
