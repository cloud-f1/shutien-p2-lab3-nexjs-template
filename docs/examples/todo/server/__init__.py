"""Tasks domain — user-owned tasks with CRUD operations + batch update."""

from app.domains import DomainConfig
from app.domains.tasks.endpoints import router
from app.domains.tasks.models import Task

domain_config = DomainConfig(
    router=router,
    prefix="/tasks",
    tags=["tasks"],
    models=[Task],
)

__all__ = ["domain_config", "Task"]
