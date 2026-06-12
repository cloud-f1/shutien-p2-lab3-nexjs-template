"""Posts domain — user-owned posts with CRUD operations."""

from app.domains import DomainConfig
from app.domains.posts.endpoints import router
from app.domains.posts.models import Post

domain_config = DomainConfig(
    router=router,
    prefix="/posts",
    tags=["posts"],
    models=[Post],
)

__all__ = ["domain_config", "Post"]
