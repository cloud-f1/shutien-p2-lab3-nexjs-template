from sqlalchemy import text
from sqlalchemy.engine import Engine


def ensure_extensions(engine: Engine) -> None:
    """Enable required PostgreSQL extensions (e.g. PostGIS).

    No-op for non-PostgreSQL backends (SQLite in tests).
    """
    drivername = engine.url.drivername
    if "sqlite" in drivername:
        return

    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        conn.commit()
