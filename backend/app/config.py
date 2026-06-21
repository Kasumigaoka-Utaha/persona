from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage"
DATABASE_PATH = BASE_DIR / "user_realtime_jury.db"


class Settings(BaseSettings):
    app_name: str = "用户实时陪审团 API"
    database_url: str = f"sqlite:///{DATABASE_PATH}"
    storage_dir: Path = STORAGE_DIR
    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    default_model: str = "gpt-4.1-mini"
    request_timeout_seconds: int = 60
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )

    model_config = SettingsConfigDict(
        env_prefix="PMS_",
        env_file=(".env", ".env.local"),
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    return settings
