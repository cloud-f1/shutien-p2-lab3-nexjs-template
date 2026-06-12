from unittest.mock import MagicMock, create_autospec

from sqlalchemy.engine import Engine
from sqlalchemy.engine.url import make_url

from app.db.extensions import ensure_extensions


def test_ensure_extensions_is_importable():
    """Verify the function can be imported from app.db.extensions."""
    assert callable(ensure_extensions)


def test_ensure_extensions_noop_for_sqlite():
    """ensure_extensions should skip execution entirely for SQLite engines."""
    engine = create_autospec(Engine, instance=True)
    engine.url = make_url("sqlite:///test.db")
    engine.connect = MagicMock()

    ensure_extensions(engine)

    # connect() should never be called for SQLite
    engine.connect.assert_not_called()
