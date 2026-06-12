"""Portfolios domain — investment collections of places."""

from app.domains import DomainConfig
from app.domains.portfolios.endpoints import router
from app.domains.portfolios.models import Portfolio, PortfolioPlace

domain_config = DomainConfig(
    router=router,
    prefix="/portfolios",
    tags=["portfolios"],
    models=[Portfolio, PortfolioPlace],
)

__all__ = ["domain_config", "Portfolio", "PortfolioPlace"]
