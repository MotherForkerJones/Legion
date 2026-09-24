"""Telegram long-polling gateway for Legion."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable, Awaitable
from typing import Any

import httpx

from legion.core.loop import AgentEngine, TraceEvent

logger = logging.getLogger(__name__)


class TelegramGateway:
    """Bridge Telegram text messages to isolated Legion agent sessions."""

    def __init__(
        self,
        token: str,
        engine_factory: Callable[[str], AgentEngine],
        allowed_chat_ids: set[int] | None = None,
        poll_timeout: int = 25,
    ) -> None:
        if not token.strip():
            raise ValueError("Telegram bot token is required")
        self.token = token
        self.engine_factory = engine_factory
        self.allowed_chat_ids = allowed_chat_ids or set()
        self.poll_timeout = poll_timeout
        self.api_url = f"https://api.telegram.org/bot{token}"
        self.offset = 0
        self._stop = asyncio.Event()

    async def _request(self, client: httpx.AsyncClient, method: str, payload: dict[str, Any]) -> Any:
        response = await client.post(f"{self.api_url}/{method}", json=payload)
        response.raise_for_status()
        data = response.json()
        if not data.get("ok"):
            raise RuntimeError(f"Telegram API error: {data.get('description', 'unknown error')}")
        return data.get("result")

    def _allowed(self, chat_id: int) -> bool:
        return not self.allowed_chat_ids or chat_id in self.allowed_chat_ids

    @staticmethod
    def _format_events(events: list[TraceEvent]) -> str:
        for event in reversed(events):
            if event.kind == "answer":
                return str(event.payload.get("content", "No answer returned."))[:4096]
        return "Legion completed without a final answer."

    async def handle_update(self, client: httpx.AsyncClient, update: dict[str, Any]) -> None:
        message = update.get("message") or {}
        chat = message.get("chat") or {}
        chat_id = chat.get("id")
        text = str(message.get("text") or "").strip()
        if not isinstance(chat_id, int) or not text:
            return
        if not self._allowed(chat_id):
            logger.warning("Rejected Telegram chat %s", chat_id)
            return
        if text in {"/start", "/help"}:
            await self._request(client, "sendMessage", {"chat_id": chat_id, "text": "Legion is online. Send a task and I will process it through the local agent."})
            return
        engine = self.engine_factory(text)
        events = [event async for event in engine.run(text)]
        await self._request(client, "sendMessage", {"chat_id": chat_id, "text": self._format_events(events)})

    async def run(self) -> None:
        """Poll Telegram until cancelled, retrying transient network failures."""
        async with httpx.AsyncClient(timeout=self.poll_timeout + 10) as client:
            await self._request(client, "deleteWebhook", {"drop_pending_updates": False})
            me = await self._request(client, "getMe", {})
            logger.info("Telegram gateway connected as @%s", me.get("username", "unknown"))
            while not self._stop.is_set():
                try:
                    updates = await self._request(client, "getUpdates", {"offset": self.offset, "timeout": self.poll_timeout, "allowed_updates": ["message"]})
                    for update in updates or []:
                        self.offset = max(self.offset, int(update.get("update_id", 0)) + 1)
                        try:
                            await self.handle_update(client, update)
                        except (httpx.HTTPError, RuntimeError, ValueError) as exc:
                            logger.exception("Telegram update failed: %s", exc)
                except (httpx.HTTPError, RuntimeError) as exc:
                    logger.warning("Telegram polling failed: %s", exc)
                    await asyncio.sleep(3)

    def stop(self) -> None:
        self._stop.set()
