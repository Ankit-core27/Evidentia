"""Settings from the repo-root .env (see .env.example).

Relative paths in DATABASE_URL and STORAGE_DIR resolve against backend/, so the
app finds the same database whether it is started from backend/ or elsewhere.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent

SQLITE_PREFIX = "sqlite:///"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    database_url: str = "sqlite:///../storage/evidentia.db"
    storage_dir: str = "../storage"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"
    gemini_embed_model: str = "gemini-embedding-001"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @property
    def resolved_database_url(self) -> str:
        """DATABASE_URL with a relative SQLite path made absolute against backend/."""
        if not self.database_url.startswith(SQLITE_PREFIX):
            return self.database_url
        path = self.database_url.removeprefix(SQLITE_PREFIX)
        if path in ("", ":memory:") or Path(path).is_absolute():
            return self.database_url
        return SQLITE_PREFIX + str((BACKEND_DIR / path).resolve())

    @property
    def storage_path(self) -> Path:
        path = Path(self.storage_dir)
        return path if path.is_absolute() else (BACKEND_DIR / path).resolve()

    @property
    def ai_enabled(self) -> bool:
        return bool(self.gemini_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
