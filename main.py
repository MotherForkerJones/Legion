"""Legion CLI and local webhook gateway."""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from legion.core.loop import AgentEngine
from legion.core.router import LLMRouter
from legion.core.sandbox import Sandbox
from legion.memory.store import MemoryStore
from legion.skills.base_skills import build_handlers, tool_definitions
from legion.skills.loader import SkillLoader


BANNER = "\033[91m" + r"""
      .-''''-.       .-''''-.       .-''''-.
     /  _  _  \     /  _  _  \     /  _  _  \
    |  (o)(o)  |   |  (o)(o)  |   |  (o)(o)  |
    |    /\    |   |    /\    |   |    /\    |
    |  \____/  |   |  \____/  |   |  \____/  |
     \  ||||  /     \  ||||  /     \  ||||  /
      `-====-'       `-====-'       `-====-'
       SEE NO          HEAR NO         SPEAK NO
          \m/             \m/             \m/
             \m/      LEGION      \m/
""" + "\033[0m"


def create_engine(workspace: Path, max_turns: int, query: str = "") -> AgentEngine:
    loader = SkillLoader(workspace / "skills")
    memory = MemoryStore(workspace / "memory" / "MEMORY.md", workspace / "memory" / "memory.sqlite3")
    memory.rebuild_index()
    memory_context = "\n".join(memory.search("facts decisions", limit=3))
    system = (workspace / "AGENTS.md").read_text(encoding="utf-8")
    if memory_context:
        system += "\n\nRelevant memory:\n" + memory_context
    router = LLMRouter()
    sandbox = Sandbox(workspace=workspace)
    skill_prompt = loader.relevant_prompt(query)
    return AgentEngine(router, build_handlers(workspace, sandbox), tool_definitions(), system + ("\n\n" + skill_prompt if skill_prompt else ""), max_turns)


async def run_prompt(prompt: str, workspace: Path, max_turns: int) -> None:
    engine = create_engine(workspace, max_turns, prompt)
    async for event in engine.run(prompt):
        print(f"[{event.kind}] {json.dumps(event.payload, ensure_ascii=True)}")


class WebhookRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=12_000)
    max_turns: int = Field(default=6, ge=1, le=8)


app = FastAPI(title="Legion", version="0.1.0")
app.state.workspace = Path(os.getenv("LEGION_WORKSPACE", Path(__file__).parent)).resolve()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/run")
async def run_webhook(request: WebhookRequest) -> dict[str, object]:
    try:
        engine = create_engine(app.state.workspace, request.max_turns, request.prompt)
        events = [event async for event in engine.run(request.prompt)]
        return {"events": [{"kind": event.kind, "payload": event.payload, "at": event.at} for event in events]}
    except (ValueError, RuntimeError, OSError) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def main() -> None:
    parser = argparse.ArgumentParser(description="Legion local-first autonomous agent harness")
    parser.add_argument("prompt", nargs="?", help="Initial user prompt")
    parser.add_argument("--workspace", type=Path, default=Path(__file__).parent)
    parser.add_argument("--max-turns", type=int, default=int(os.getenv("LEGION_MAX_TURNS", "8")))
    parser.add_argument("--web", action="store_true", help="Start the local FastAPI gateway")
    parser.add_argument("--port", type=int, default=8787)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    if args.web:
        import uvicorn
        app.state.workspace = args.workspace.resolve()
        uvicorn.run("legion.main:app", host="127.0.0.1", port=args.port, reload=False)
    elif args.prompt:
        print(BANNER)
        asyncio.run(run_prompt(args.prompt, args.workspace.resolve(), args.max_turns))
    else:
        parser.error("provide a prompt or use --web")


if __name__ == "__main__":
    main()
