"""Application settings, read from environment variables (or a local .env file).

Nothing secret is stored in the code. In production the app refuses to start
if the important security settings are missing or left at insecure defaults.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_PLACEHOLDER_SECRETS = {"", "change-me", "changeme", "replace-with-a-long-random-string"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"

    # Database (e.g. postgresql+psycopg://user:password@host:5432/dbname)
    database_url: str = ""

    # Used for signing/derivation tasks. Must be long and random in production.
    secret_key: str = ""

    # Browser origins allowed to call the API, comma separated.
    frontend_origins: str = "http://localhost:5173"

    # Session cookie behaviour
    cookie_secure: bool = False  # forced to True in production
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    session_hours: int = Field(default=8, ge=1, le=24 * 30)
    session_hours_remembered: int = Field(default=24 * 30, ge=1, le=24 * 90)

    # Request body limit in bytes (JSON API only, so 1 MB is generous)
    max_request_bytes: int = Field(default=1_000_000, ge=1_000)

    # Optional email sending for password resets (see services/email.py)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "ResearchHub <no-reply@localhost>"

    log_level: str = "INFO"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def public_app_url(self) -> str:
        """Where the frontend lives; used to build password-reset links."""
        return self.cors_origins[0] if self.cors_origins else "http://localhost:5173"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.frontend_origins.split(",") if o.strip()]

    @model_validator(mode="after")
    def _check_production_safety(self) -> "Settings":
        if "*" in self.cors_origins:
            raise ValueError("FRONTEND_ORIGINS must list explicit origins, never '*'.")
        if self.is_production:
            problems = []
            if self.secret_key.lower() in _PLACEHOLDER_SECRETS or len(self.secret_key) < 32:
                problems.append("SECRET_KEY must be a random string of at least 32 characters")
            if not self.cookie_secure:
                problems.append("COOKIE_SECURE must be true")
            if any(o.startswith("http://") for o in self.cors_origins):
                problems.append("FRONTEND_ORIGINS must use https:// origins")
            if problems:
                raise ValueError("Insecure production configuration: " + "; ".join(problems))
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
