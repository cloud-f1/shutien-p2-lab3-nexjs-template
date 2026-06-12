import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings
from app.core.alembic_hooks import render_item, compare_type
from app.models.base import Base
import app.models  # noqa: F401 — ensure all models are imported for autogenerate

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")


def _get_context_kwargs(is_online: bool = True) -> dict:
    """Build shared context.configure() kwargs, dialect-aware."""
    kwargs: dict = {
        "target_metadata": target_metadata,
        "render_item": render_item,
        "compare_type": compare_type,
    }

    # PostgreSQL: enable server_default comparison for precise autogenerate.
    # SQLite: skip — text-based default storage causes false positives.
    if not _is_sqlite:
        kwargs["compare_server_default"] = True

    return kwargs


def run_migrations_offline() -> None:
    url = settings.DATABASE_URL
    context.configure(
        url=url,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        **_get_context_kwargs(is_online=False),
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        **_get_context_kwargs(is_online=True),
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(settings.DATABASE_URL)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
