"""Asynchronous Observe -> Think -> Act agent loop."""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from legion.core.router import LLMRouter
from legion.core.sandbox import SandboxError

logger = logging.getLogger(__name__)


@dataclass
class TraceEvent:
    kind: str
    payload: dict[str, Any]
    at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AgentEngine:
    def __init__(self, router: LLMRouter, handlers: dict[str, Any], tool_definitions: list[dict[str, Any]], system_prompt: str, max_turns: int = 8) -> None:
        self.router = router
        self.handlers = handlers
        self.tool_definitions = tool_definitions
        self.system_prompt = system_prompt
        self.max_turns = max_turns
        self.history: list[dict[str, Any]] = []
        self.trace: list[TraceEvent] = []

    def _record(self, kind: str, **payload: Any) -> None:
        self.trace.append(TraceEvent(kind, payload))

    @staticmethod
    def _message(response: dict[str, Any]) -> dict[str, Any]:
        choices = response.get("choices", [])
        if not choices:
            raise RuntimeError("Model returned no choices")
        message = choices[0].get("message", {})
        if not isinstance(message, dict):
            raise RuntimeError("Model returned an invalid message")
        return message

    async def run(self, prompt: str) -> AsyncIterator[TraceEvent]:
        if not self.history:
            self.history.append({"role": "system", "content": self.system_prompt})
        self.history.append({"role": "user", "content": prompt})
        self._record("observe", prompt=prompt)
        yield self.trace[-1]
        for turn in range(1, self.max_turns + 1):
            self._record("think", turn=turn)
            yield self.trace[-1]
            response = await self.router.complete(self.history, self.tool_definitions)
            message = self._message(response)
            self.history.append(message)
            calls = message.get("tool_calls") or []
            if not calls:
                content = str(message.get("content") or "")
                self._record("answer", turn=turn, content=content)
                yield self.trace[-1]
                return
            for call in calls:
                name = call.get("function", {}).get("name", "")
                raw_args = call.get("function", {}).get("arguments", "{}")
                try:
                    arguments = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                    if not isinstance(arguments, dict):
                        raise ValueError("tool arguments must be an object")
                    if name not in self.handlers:
                        raise ValueError(f"unknown tool: {name}")
                    result = await self.handlers[name](arguments)
                except (SandboxError, ValueError, TypeError, json.JSONDecodeError) as exc:
                    result = {"error": str(exc)}
                tool_message = {"role": "tool", "tool_call_id": call.get("id", str(uuid.uuid4())), "name": name, "content": json.dumps(result, ensure_ascii=True)}
                self.history.append(tool_message)
                self._record("act", turn=turn, tool=name, result=result)
                yield self.trace[-1]
        self._record("limit", max_turns=self.max_turns)
        yield self.trace[-1]
