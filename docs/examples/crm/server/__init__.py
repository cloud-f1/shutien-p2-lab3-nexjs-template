"""Contacts domain — user-owned contacts with CRUD operations + search."""

from app.domains import DomainConfig
from app.domains.contacts.endpoints import router
from app.domains.contacts.models import Contact

domain_config = DomainConfig(
    router=router,
    prefix="/contacts",
    tags=["contacts"],
    models=[Contact],
)

__all__ = ["domain_config", "Contact"]
