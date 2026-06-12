"""Domain registry — auto-discovers domain packages under app/domains/.

Each domain package must expose:
  router:  APIRouter   — endpoint routes
  prefix:  str         — URL prefix (e.g. "/places")
  tags:    list[str]   — OpenAPI tags
  models:  list[type]  — SQLAlchemy model classes (for Alembic discovery)
"""

from __future__ import annotations

import importlib
import logging
import pkgutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import APIRouter

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DomainConfig:
    """Standard interface each domain package exposes."""

    router: APIRouter
    prefix: str
    tags: list[str] = field(default_factory=list)
    models: list[type] = field(default_factory=list)


def discover_domains() -> list[DomainConfig]:
    """Scan app/domains/ subpackages and collect their DomainConfig.

    A domain package is included if it has a module-level `domain_config`
    attribute of type DomainConfig. Packages without it are silently skipped.
    """
    configs: list[DomainConfig] = []
    package_path = str(Path(__file__).parent)

    for info in pkgutil.iter_modules([package_path]):
        if not info.ispkg:
            continue
        module_name = f"app.domains.{info.name}"
        try:
            mod = importlib.import_module(module_name)
        except Exception:
            logger.warning("Failed to import domain %s", module_name, exc_info=True)
            continue

        config = getattr(mod, "domain_config", None)
        if isinstance(config, DomainConfig):
            configs.append(config)
            logger.debug("Registered domain: %s (prefix=%s)", info.name, config.prefix)
        else:
            logger.debug("Skipped %s — no domain_config found", info.name)

    return configs
