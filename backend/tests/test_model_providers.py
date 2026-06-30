import asyncio
from typing import Any

import pytest

from app.config import Settings, get_settings
from app.services import prediction
from app.services.prediction import PredictionError, PredictionService


class FakeResponse:
    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, Any]:
        return {"choices": [{"message": {"content": '{"ok": true}'}}]}


class FakeAsyncClient:
    calls: list[dict[str, Any]] = []

    def __init__(self, timeout: int):
        self.timeout = timeout

    async def __aenter__(self) -> "FakeAsyncClient":
        return self

    async def __aexit__(self, exc_type: object, exc: object, tb: object) -> None:
        return None

    async def post(self, url: str, headers: dict[str, str], json: dict[str, Any]) -> FakeResponse:
        self.calls.append({"url": url, "headers": headers, "json": json, "timeout": self.timeout})
        return FakeResponse()


def test_active_model_config_reads_deepseek_env(monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("PMS_AI_PROVIDER", "deepseek")
    monkeypatch.setenv("PMS_DEEPSEEK_API_KEY", "deepseek-key")
    monkeypatch.setenv("PMS_DEEPSEEK_MODEL", "deepseek-custom")

    config = get_settings().active_model_config()

    assert config.provider == "deepseek"
    assert config.api_key == "deepseek-key"
    assert config.base_url == "https://api.deepseek.com"
    assert config.model == "deepseek-custom"
    get_settings.cache_clear()


def test_openai_keeps_default_model_fallback() -> None:
    config = Settings(
        ai_provider="openai",
        openai_api_key="openai-key",
        default_model="legacy-model",
    ).active_model_config()

    assert config.provider == "openai"
    assert config.model == "legacy-model"


def test_missing_doubao_model_errors_clearly() -> None:
    service = PredictionService(db=None)  # type: ignore[arg-type]
    service.settings = Settings(ai_provider="doubao", doubao_api_key="doubao-key")

    with pytest.raises(PredictionError, match="PMS_DOUBAO_MODEL"):
        asyncio.run(service._call_model({"prompt": "test"}, "medium"))


def test_deepseek_payload_uses_provider_url_and_reasoning_effort(monkeypatch: pytest.MonkeyPatch) -> None:
    FakeAsyncClient.calls = []
    monkeypatch.setattr(prediction.httpx, "AsyncClient", FakeAsyncClient)
    service = PredictionService(db=None)  # type: ignore[arg-type]
    service.settings = Settings(
        ai_provider="deepseek",
        deepseek_api_key="deepseek-key",
        deepseek_model="deepseek-v4-flash",
    )

    result = asyncio.run(service._call_model({"prompt": "test"}, "low"))

    call = FakeAsyncClient.calls[0]
    assert result == {"ok": True}
    assert call["url"] == "https://api.deepseek.com/chat/completions"
    assert call["headers"]["Authorization"] == "Bearer deepseek-key"
    assert call["json"]["model"] == "deepseek-v4-flash"
    assert call["json"]["reasoning_effort"] == "low"
    assert "model_reasoning_effort" not in call["json"]


def test_doubao_payload_uses_ark_url_without_reasoning_effort(monkeypatch: pytest.MonkeyPatch) -> None:
    FakeAsyncClient.calls = []
    monkeypatch.setattr(prediction.httpx, "AsyncClient", FakeAsyncClient)
    service = PredictionService(db=None)  # type: ignore[arg-type]
    service.settings = Settings(
        ai_provider="doubao",
        doubao_api_key="doubao-key",
        doubao_model="doubao-endpoint-model",
    )

    asyncio.run(service._call_model({"prompt": "test"}, "high"))

    call = FakeAsyncClient.calls[0]
    assert call["url"] == "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
    assert call["headers"]["Authorization"] == "Bearer doubao-key"
    assert call["json"]["model"] == "doubao-endpoint-model"
    assert "reasoning_effort" not in call["json"]
    assert "model_reasoning_effort" not in call["json"]
