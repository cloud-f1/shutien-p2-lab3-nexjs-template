"""Places domain — user-owned locations with geo queries."""

from app.domains import DomainConfig
from app.domains.places.endpoints import router
from app.domains.places.models import Place

domain_config = DomainConfig(
    router=router,
    prefix="/places",
    tags=["places"],
    models=[Place],
)

__all__ = ["domain_config", "Place"]
