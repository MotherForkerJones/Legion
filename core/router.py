"""OpenAI-compatible routing across local and remote model endpoints."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, AsyncIterator, Protocol

import httpx


class ChatProvider(Protocol):
    """Protocol implemented by any OpenAI-compatible chat backend."""

    name: str
    model: str

    async def complete(self, messages: list[dict[str, Any]], tools: list[dict[str, Any]] | None = None) -> dict[str, Any]: ...
    async def stream(self, messages: list[dict[str, Any]], tools: list[dict[str, Any]] | None = None) -> AsyncIterator[str]: ...


@dataclass
class OpenAICompatibleProvider:
    """A provider for Ollama, vLLM, or any compatible `/chat/completions` API."""

    name: str
    base_url: str
    model: str
    api_key: str | None = None
    timeout: float = 120.0

    def _headers(self) -> dict[str, str]:
        headers = {"content-type": "application/json"}
        if self.api_key:
            headers["authorization"] = f"Bearer {self.api_key}"
        return headers

    def _payload(self, messages: list[dict[str, Any]], tools: list[dict[str, Any]] | None) -> dict[str, Any]:
        payload: dict[str, Any] = {"model": self.model, "messages": messages, "stream": False}
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"
        return payload

    async def complete(self, messages: list[dict[str, Any]], tools: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(f"{self.base_url.rstrip('/')}/chat/completions", headers=self._headers(), json=self._payload(messages, tools))
            response.raise_for_status()
            return response.json()

    async def stream(self, messages: list[dict[str, Any]], tools: list[dict[str, Any]] | None = None) -> AsyncIterator[str]:
        payload = self._payload(messages, tools)
        payload["stream"] = True
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream("POST", f"{self.base_url.rstrip('/')}/chat/completions", headers=self._headers(), json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line.removeprefix("data:").strip()
                    if data == "[DONE]":
                        break
                    try:
                        delta = json.loads(data)["choices"][0].get("delta", {})
                        content = delta.get("content")
                        if content:
                            yield content
                    except (KeyError, json.JSONDecodeError):
                        continue


class LLMRouter:
    """Routes requests in priority order and permits model hot-swapping."""

    def __init__(self, providers: list[OpenAICompatibleProvider] | None = None) -> None:
        self.providers = providers or self.from_environment()
        if not self.providers:
            raise ValueError("No model providers configured. Set LEGION_OLLAMA_MODEL or LEGION_API_BASE_URL.")
        self.active_index = 0

    @classmethod
    def from_environment(cls) -> list[OpenAICompatibleProvider]:
        providers: list[OpenAICompatibleProvider] = []
        ollama_model = os.getenv("LEGION_OLLAMA_MODEL", "")
        if ollama_model:
            providers.append(OpenAICompatibleProvider("ollama", os.getenv("LEGION_OLLAMA_BASE_URL", "http://localhost:11434/v1"), ollama_model))
        api_base = os.getenv("LEGION_API_BASE_URL", "")
        if api_base and os.getenv("LEGION_API_MODEL"):
            providers.append(OpenAICompatibleProvider("api", api_base, os.getenv("LEGION_API_MODEL", ""), os.getenv("LEGION_API_KEY")))
        return providers

    @property
    def active(self) -> OpenAICompatibleProvider:
        return self.providers[self.active_index]

    def switch_model(self, model: str, provider_name: str | None = None) -> None:
        for index, provider in enumerate(self.providers):
            if provider.model == model and (provider_name is None or provider.name == provider_name):
                self.active_index = index
                return
        raise ValueError(f"No configured provider matches model {model!r}")

    async def complete(self, messages: list[dict[str, Any]], tools: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        failures: list[str] = []
        for offset in range(len(self.providers)):
            index = (self.active_index + offset) % len(self.providers)
            try:
                result = await self.providers[index].complete(messages, tools)
                self.active_index = index
                return result
            except (httpx.HTTPError, OSError) as exc:
                failures.append(f"{self.providers[index].name}: {exc}")
        raise RuntimeError("All model providers failed: " + " | ".join(failures))

    async def stream(self, messages: list[dict[str, Any]], tools: list[dict[str, Any]] | None = None) -> AsyncIterator[str]:
        provider = self.active
        async for chunk in provider.stream(messages, tools):
            yield chunk
