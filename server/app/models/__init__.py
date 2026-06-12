from app.models.base import Base
from app.models.session import Session
from app.models.user import OAuthAccount, User

# Core models (always present)
__all__ = [
    "Base",
    "OAuthAccount",
    "Session",
    "User",
]

# Domain models (auto-discovered — imports models.py only, avoids circular deps)
import importlib
import logging
import pkgutil
from pathlib import Path

_logger = logging.getLogger(__name__)
_domains_path = str(Path(__file__).parent.parent / "domains")

for _info in pkgutil.iter_modules([_domains_path]):
    if not _info.ispkg:
        continue
    _mod_name = f"app.domains.{_info.name}.models"
    try:
        _mod = importlib.import_module(_mod_name)
    except Exception:
        _logger.debug("No models in domain %s", _info.name)
        continue
    for _attr_name in getattr(_mod, "__all__", dir(_mod)):
        _attr = getattr(_mod, _attr_name, None)
        if isinstance(_attr, type) and issubclass(_attr, Base) and _attr is not Base:
            globals()[_attr_name] = _attr
            __all__.append(_attr_name)
