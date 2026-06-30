from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage"
DATABASE_PATH = BASE_DIR / "user_realtime_jury.db"


@dataclass(frozen=True)
class ActiveModelConfig:
    provider: str
    api_key: str | None
    api_key_env: str
    base_url: str
    model: str | None
    model_env: str


class Settings(BaseSettings):
    app_name: str = "用户实时陪审团 API"
    database_url: str = f"sqlite:///{DATABASE_PATH}"
    storage_dir: Path = STORAGE_DIR
    ai_provider: str = "openai"
    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str | None = None
    default_model: str = "gpt-4.1-mini"
    doubao_api_key: str | None = None
    doubao_base_url: str = "https://ark.cn-beijing.volces.com/api/v3"
    doubao_model: str | None = None
    deepseek_api_key: str | None = None
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-v4-flash"
    gemini_api_key: str | None = None
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    gemini_model: str = "gemini-2.5-flash"
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

    def active_model_config(self) -> ActiveModelConfig:
        provider = self.ai_provider.strip().lower()
        if provider == "openai":
            return ActiveModelConfig(
                provider=provider,
                api_key=self.openai_api_key,
                api_key_env="PMS_OPENAI_API_KEY",
                base_url=self.openai_base_url,
                model=self.openai_model or self.default_model,
                model_env="PMS_OPENAI_MODEL or PMS_DEFAULT_MODEL",
            )
        if provider == "doubao":
            return ActiveModelConfig(
                provider=provider,
                api_key=self.doubao_api_key,
                api_key_env="PMS_DOUBAO_API_KEY",
                base_url=self.doubao_base_url,
                model=self.doubao_model,
                model_env="PMS_DOUBAO_MODEL",
            )
        if provider == "deepseek":
            return ActiveModelConfig(
                provider=provider,
                api_key=self.deepseek_api_key,
                api_key_env="PMS_DEEPSEEK_API_KEY",
                base_url=self.deepseek_base_url,
                model=self.deepseek_model,
                model_env="PMS_DEEPSEEK_MODEL",
            )
        if provider == "gemini":
            return ActiveModelConfig(
                provider=provider,
                api_key=self.gemini_api_key,
                api_key_env="PMS_GEMINI_API_KEY",
                base_url=self.gemini_base_url,
                model=self.gemini_model,
                model_env="PMS_GEMINI_MODEL",
            )
        raise ValueError("PMS_AI_PROVIDER must be one of: openai, doubao, deepseek, gemini")

    def model_config_for_provider(self, provider: str) -> ActiveModelConfig:
        return self.model_copy(update={"ai_provider": provider}).active_model_config()


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    return settings
