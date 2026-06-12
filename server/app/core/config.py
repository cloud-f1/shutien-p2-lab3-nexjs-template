import logging
import os
from functools import cached_property

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)

_DEFAULT_SECRET = "CHANGE_ME_TO_A_RANDOM_64_CHAR_HEX_STRING"
_DEFAULT_REFRESH = _DEFAULT_SECRET + "_refresh"
_PLACEHOLDER_VALUES = {
    _DEFAULT_SECRET,
    _DEFAULT_REFRESH,
    "CHANGE_ME_REFRESH_SECRET",
    "changeme",
    "secret",
}


def _is_test_env() -> bool:
    """Return True when running inside a test suite (pytest sets TESTING=1)."""
    return os.getenv("TESTING", "").strip() not in ("", "0", "false")


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://saas_user:saas_pass@localhost:5432/saas_dev"

    # JWT
    SECRET_KEY: str = _DEFAULT_SECRET
    SECRET_KEY_PREVIOUS: str = ""
    REFRESH_SECRET_KEY: str = _DEFAULT_REFRESH
    REFRESH_SECRET_KEY_PREVIOUS: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # OAuth2
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # GitHub OAuth2
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""

    # Email — provider system (E66)
    EMAIL_PROVIDER: str = "console"
    EMAIL_FROM: str = "noreply@example.com"
    MAILGUN_API_KEY: str = ""
    MAILGUN_DOMAIN: str = ""
    ZEABUR_EMAIL_API_KEY: str = ""

    # Monitoring
    SENTRY_DSN: str = ""
    APP_VERSION: str = "1.0.0"

    # Logging
    LOG_FORMAT: str = "console"  # "console" or "json"

    # App
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS_STR: str = "http://localhost:3000,http://localhost:5173"
    RATE_LIMIT_AUTH: str = "15/minute"
    RATE_LIMIT_GENERAL: str = "200/minute"

    # Test helpers (E150) — triple-guarded, never enable in production
    ENABLE_TEST_HELPERS: bool = False

    # Stripe billing
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    @field_validator("SECRET_KEY")
    @classmethod
    def _reject_placeholder_secret(cls, v: str) -> str:
        if _is_test_env():
            return v
        if v in _PLACEHOLDER_VALUES:
            raise ValueError(
                "SECRET_KEY is still the default placeholder. "
                "Run `make go` or set a random hex string "
                "(e.g. `openssl rand -hex 32`)."
            )
        return v

    @field_validator("REFRESH_SECRET_KEY")
    @classmethod
    def _reject_placeholder_refresh(cls, v: str) -> str:
        if _is_test_env():
            return v
        if v in _PLACEHOLDER_VALUES:
            raise ValueError(
                "REFRESH_SECRET_KEY is still the default placeholder. "
                "Run `make go` or set a random hex string "
                "(e.g. `openssl rand -hex 32`)."
            )
        return v

    @field_validator("DATABASE_URL")
    @classmethod
    def _validate_database_url(cls, v: str) -> str:
        """Accept both TCP and Cloud SQL Unix socket formats.

        Cloud SQL: postgresql+asyncpg://user:pass@/dbname?host=/cloudsql/project:region:instance
        TCP:       postgresql+asyncpg://user:pass@host:5432/dbname

        asyncpg handles both natively — no transformation needed.
        """
        if "/cloudsql/" in v:
            logger.info(
                "Cloud SQL Unix socket detected in DATABASE_URL — "
                "connecting via /cloudsql/ socket path"
            )
        return v

    @cached_property
    def ALLOWED_ORIGINS(self) -> list[str]:
        return [s.strip() for s in self.ALLOWED_ORIGINS_STR.split(",") if s.strip()]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    @model_validator(mode="after")
    def _check_secrets(self) -> "Settings":
        if self.ENVIRONMENT != "development":
            if self.SECRET_KEY == self.REFRESH_SECRET_KEY:
                raise ValueError(
                    "REFRESH_SECRET_KEY must differ from SECRET_KEY in non-development environments"
                )
        return self

    def validate_production_config(self) -> None:
        """Fail fast if production environment has insecure defaults.

        Called during app lifespan startup. Raises SystemExit with
        actionable error messages so the process never serves traffic
        with placeholder secrets or an inappropriate database.
        """
        if _is_test_env():
            return
        if self.ENVIRONMENT != "production":
            return

        errors: list[str] = []

        if self.SECRET_KEY in _PLACEHOLDER_VALUES:
            errors.append(
                "SECRET_KEY is a placeholder. "
                "Set it to a secure random value (e.g. `openssl rand -hex 32`)."
            )
        if self.REFRESH_SECRET_KEY in _PLACEHOLDER_VALUES:
            errors.append(
                "REFRESH_SECRET_KEY is a placeholder. "
                "Set it to a secure random value (e.g. `openssl rand -hex 32`)."
            )
        if "sqlite" in self.DATABASE_URL.lower():
            errors.append(
                "DATABASE_URL uses SQLite, which is not suitable for production. "
                "Set it to a PostgreSQL connection string."
            )

        if errors:
            msg = (
                "\n\n"
                "═══ PRODUCTION SAFETY CHECK FAILED ═══\n\n"
                + "\n".join(f"  • {e}" for e in errors)
                + "\n\n"
                "The server refuses to start with insecure defaults.\n"
                "Fix the issues above and restart.\n"
            )
            raise SystemExit(msg)


settings = Settings()
