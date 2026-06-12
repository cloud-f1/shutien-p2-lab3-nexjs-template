import os

import pytest

from app.core.config import Settings


def test_allowed_origins_comma_separated():
    s = Settings(ALLOWED_ORIGINS_STR="http://a.com, http://b.com ,http://c.com")
    assert s.ALLOWED_ORIGINS == ["http://a.com", "http://b.com", "http://c.com"]


def test_allowed_origins_single():
    s = Settings(ALLOWED_ORIGINS_STR="http://localhost:3000")
    assert s.ALLOWED_ORIGINS == ["http://localhost:3000"]


def test_allowed_origins_empty():
    s = Settings(ALLOWED_ORIGINS_STR="")
    assert s.ALLOWED_ORIGINS == []


def test_allowed_origins_default():
    s = Settings()
    assert "http://localhost:3000" in s.ALLOWED_ORIGINS
    assert "http://localhost:5173" in s.ALLOWED_ORIGINS


def test_sentry_dsn_default_empty():
    s = Settings()
    assert s.SENTRY_DSN == ""


def test_app_version_default():
    s = Settings()
    assert s.APP_VERSION == "1.0.0"


def test_placeholder_secret_rejected_outside_test_env(monkeypatch):
    """SECRET_KEY placeholder is rejected when TESTING is not set."""
    monkeypatch.setenv("TESTING", "")
    with pytest.raises(ValueError, match="SECRET_KEY is still the default placeholder"):
        Settings(SECRET_KEY="CHANGE_ME_TO_A_RANDOM_64_CHAR_HEX_STRING")


def test_placeholder_refresh_rejected_outside_test_env(monkeypatch):
    """REFRESH_SECRET_KEY placeholder is rejected when TESTING is not set."""
    monkeypatch.setenv("TESTING", "")
    with pytest.raises(ValueError, match="REFRESH_SECRET_KEY is still the default placeholder"):
        Settings(
            SECRET_KEY="a-secure-key-that-is-not-default",
            REFRESH_SECRET_KEY="CHANGE_ME_REFRESH_SECRET",
        )


def test_production_rejects_same_secrets(monkeypatch):
    monkeypatch.setenv("TESTING", "")
    with pytest.raises(ValueError, match="REFRESH_SECRET_KEY must differ"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="a-secure-key-that-is-not-default",
            REFRESH_SECRET_KEY="a-secure-key-that-is-not-default",
        )


def test_placeholder_allowed_in_test_env():
    """With TESTING=1 (set by conftest), placeholder values are allowed."""
    assert os.environ.get("TESTING") == "1"
    # Should NOT raise — validators skip in test env
    s = Settings(SECRET_KEY="CHANGE_ME_TO_A_RANDOM_64_CHAR_HEX_STRING")
    assert s.SECRET_KEY == "CHANGE_ME_TO_A_RANDOM_64_CHAR_HEX_STRING"


def test_valid_secrets_accepted(monkeypatch):
    """Real secret values are always accepted."""
    monkeypatch.setenv("TESTING", "")
    s = Settings(
        SECRET_KEY="abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
        REFRESH_SECRET_KEY="xyz789xyz789xyz789xyz789xyz789xyz789xyz789xyz789xyz789xyz789xyzx",
    )
    assert len(s.SECRET_KEY) == 64


# ─── E104: Production Safety Gate ────────────────────────────


class TestValidateProductionConfig:
    """Tests for validate_production_config() — fail-fast on insecure production defaults."""

    SAFE_SECRET = "abc123def456abc123def456abc123def456abc123def456abc123def456abcd"
    SAFE_REFRESH = "xyz789xyz789xyz789xyz789xyz789xyz789xyz789xyz789xyz789xyz789xyzx"
    POSTGRES_URL = "postgresql+asyncpg://user:pass@localhost:5432/prod"

    def _make_settings(self, **overrides):
        """Create a Settings instance with TESTING=1 (so field validators pass),
        then use object.__setattr__ for fields that need placeholder values."""
        # TESTING=1 is already set by conftest, so placeholder field validators are skipped
        s = Settings(
            SECRET_KEY=self.SAFE_SECRET,
            REFRESH_SECRET_KEY=self.SAFE_REFRESH,
            DATABASE_URL=overrides.get("DATABASE_URL", self.POSTGRES_URL),
            ENVIRONMENT=overrides.get("ENVIRONMENT", "production"),
        )
        # Override fields that need placeholder values (bypassing field validators)
        if "SECRET_KEY" in overrides:
            object.__setattr__(s, "SECRET_KEY", overrides["SECRET_KEY"])
        if "REFRESH_SECRET_KEY" in overrides:
            object.__setattr__(s, "REFRESH_SECRET_KEY", overrides["REFRESH_SECRET_KEY"])
        return s

    def test_placeholder_secret_production_raises(self, monkeypatch):
        """Placeholder SECRET_KEY in production → SystemExit."""
        monkeypatch.setenv("TESTING", "")
        s = self._make_settings(
            SECRET_KEY="CHANGE_ME_TO_A_RANDOM_64_CHAR_HEX_STRING",
        )
        with pytest.raises(SystemExit, match="SECRET_KEY is a placeholder"):
            s.validate_production_config()

    def test_placeholder_refresh_production_raises(self, monkeypatch):
        """Placeholder REFRESH_SECRET_KEY in production → SystemExit."""
        monkeypatch.setenv("TESTING", "")
        s = self._make_settings(
            REFRESH_SECRET_KEY="CHANGE_ME_REFRESH_SECRET",
        )
        with pytest.raises(SystemExit, match="REFRESH_SECRET_KEY is a placeholder"):
            s.validate_production_config()

    def test_sqlite_production_raises(self, monkeypatch):
        """SQLite DATABASE_URL in production → SystemExit."""
        monkeypatch.setenv("TESTING", "")
        s = self._make_settings(
            DATABASE_URL="sqlite+aiosqlite:///./test.db",
        )
        with pytest.raises(SystemExit, match="DATABASE_URL uses SQLite"):
            s.validate_production_config()

    def test_development_env_no_error(self, monkeypatch):
        """Placeholder secrets in development → no error (gate is production-only)."""
        monkeypatch.setenv("TESTING", "")
        s = self._make_settings(
            ENVIRONMENT="development",
            SECRET_KEY="CHANGE_ME_TO_A_RANDOM_64_CHAR_HEX_STRING",
            REFRESH_SECRET_KEY="CHANGE_ME_REFRESH_SECRET",
            DATABASE_URL="sqlite+aiosqlite:///./test.db",
        )
        # Should NOT raise
        s.validate_production_config()

    def test_test_env_skips_validation(self):
        """TESTING=1 skips production validation entirely."""
        # TESTING=1 is set by conftest — don't override it
        s = self._make_settings(
            ENVIRONMENT="production",
            SECRET_KEY="CHANGE_ME_TO_A_RANDOM_64_CHAR_HEX_STRING",
        )
        # Should NOT raise even with placeholder + production
        s.validate_production_config()

    def test_real_secrets_production_passes(self, monkeypatch):
        """Real secrets + PostgreSQL in production → no error."""
        monkeypatch.setenv("TESTING", "")
        s = self._make_settings()
        # Should NOT raise
        s.validate_production_config()

    def test_multiple_errors_reported(self, monkeypatch):
        """All violations are reported in a single SystemExit message."""
        monkeypatch.setenv("TESTING", "")
        s = self._make_settings(
            DATABASE_URL="sqlite+aiosqlite:///./test.db",
            SECRET_KEY="changeme",
            REFRESH_SECRET_KEY="secret",
        )
        with pytest.raises(SystemExit) as exc_info:
            s.validate_production_config()
        msg = str(exc_info.value)
        assert "SECRET_KEY" in msg
        assert "REFRESH_SECRET_KEY" in msg
        assert "SQLite" in msg


# ─── E122: DATABASE_URL Cloud SQL adapter ────────────────────


class TestDatabaseURLValidator:
    """Tests for DATABASE_URL field validator — Cloud SQL Unix socket detection."""

    def test_tcp_url_accepted(self):
        """Standard TCP DATABASE_URL passes without modification."""
        s = Settings(DATABASE_URL="postgresql+asyncpg://user:pass@host:5432/db")
        assert s.DATABASE_URL == "postgresql+asyncpg://user:pass@host:5432/db"

    def test_cloud_sql_unix_socket_accepted(self):
        """Cloud SQL Unix socket URL passes without modification."""
        url = "postgresql+asyncpg://user:pass@/dbname?host=/cloudsql/proj:us-central1:inst"
        s = Settings(DATABASE_URL=url)
        assert s.DATABASE_URL == url

    def test_cloud_sql_logs_info(self, caplog):
        """Cloud SQL URL triggers an info-level log message."""
        import logging

        url = "postgresql+asyncpg://user:pass@/db?host=/cloudsql/proj:region:inst"
        with caplog.at_level(logging.INFO, logger="app.core.config"):
            Settings(DATABASE_URL=url)
        assert "Cloud SQL Unix socket detected" in caplog.text

    def test_tcp_url_no_cloud_sql_log(self, caplog):
        """Standard TCP URL does not trigger Cloud SQL log message."""
        import logging

        with caplog.at_level(logging.INFO, logger="app.core.config"):
            Settings(DATABASE_URL="postgresql+asyncpg://user:pass@host:5432/db")
        assert "Cloud SQL" not in caplog.text

    def test_sqlite_url_accepted_in_test(self):
        """SQLite URL is accepted (used in test environments)."""
        s = Settings(DATABASE_URL="sqlite+aiosqlite:///./test.db")
        assert "sqlite" in s.DATABASE_URL
