"""Legion CLI and local webhook gateway."""

from __future__ import annotations

import argparse
import asyncio
import hmac
import json
import logging
import os
import shutil
import secrets
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from legion.core.loop import AgentEngine
from legion.core.router import LLMRouter
from legion.core.sandbox import Sandbox
from legion.core.telegram import TelegramGateway
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


async def run_telegram(workspace: Path, max_turns: int) -> None:
    token = os.getenv("LEGION_TELEGRAM_BOT_TOKEN", "")
    allowed = {int(value) for value in os.getenv("LEGION_TELEGRAM_ALLOWED_CHAT_IDS", "").split(",") if value.strip()}
    gateway = TelegramGateway(token, lambda query: create_engine(workspace, max_turns, query), allowed_chat_ids=allowed)
    await gateway.run()


def apply_runtime_config(args: argparse.Namespace) -> None:
    values = {
        "LEGION_WORKSPACE": str(args.workspace.resolve()) if getattr(args, "workspace", None) else None,
        "LEGION_MAX_TURNS": str(args.max_turns) if getattr(args, "max_turns", None) else None,
        "LEGION_OLLAMA_MODEL": args.model,
        "LEGION_OLLAMA_BASE_URL": args.ollama_base_url,
        "LEGION_API_BASE_URL": args.api_base_url,
        "LEGION_API_MODEL": args.api_model,
        "LEGION_AUTH_TOKEN": args.auth_token,
    }
    for key, value in values.items():
        if value:
            os.environ[key] = value


def add_runtime_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--workspace", type=Path, default=Path(__file__).parent)
    parser.add_argument("--max-turns", type=int, default=int(os.getenv("LEGION_MAX_TURNS", "6")))
    parser.add_argument("--model", default=os.getenv("LEGION_OLLAMA_MODEL"), help="Local Ollama model name")
    parser.add_argument("--ollama-base-url", default=os.getenv("LEGION_OLLAMA_BASE_URL"), help="OpenAI-compatible Ollama URL")
    parser.add_argument("--api-base-url", default=os.getenv("LEGION_API_BASE_URL"), help="Optional remote fallback URL")
    parser.add_argument("--api-model", default=os.getenv("LEGION_API_MODEL"), help="Optional remote fallback model")
    parser.add_argument("--auth-token", default=os.getenv("LEGION_AUTH_TOKEN"), help="Bearer token for the web gateway")


def doctor(workspace: Path) -> int:
    checks = {
        "workspace": workspace.is_dir(),
        "agents.md": (workspace / "AGENTS.md").is_file(),
        "ollama": bool(shutil.which("ollama") or Path(os.getenv("LOCALAPPDATA", ""), "Programs", "Ollama", "ollama.exe").is_file()),
        "docker-cli": bool(shutil.which("docker")),
        "model-configured": bool(os.getenv("LEGION_OLLAMA_MODEL")),
    }
    for name, passed in checks.items():
        print(f"{'OK' if passed else 'MISSING':8} {name}")
    return 0 if all(checks.values()) else 1


class WebhookRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=12_000)
    max_turns: int = Field(default=6, ge=1, le=8)


app = FastAPI(title="Legion", version="0.1.0")
app.state.workspace = Path(os.getenv("LEGION_WORKSPACE", Path(__file__).parent)).resolve()
app.state.auth_token = os.getenv("LEGION_AUTH_TOKEN") or secrets.token_urlsafe(24)


def require_auth(authorization: str | None = Header(default=None)) -> None:
    expected = f"Bearer {app.state.auth_token}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Bearer authentication required")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/run")
async def run_webhook(request: WebhookRequest, _: None = Depends(require_auth)) -> dict[str, object]:
    try:
        engine = create_engine(app.state.workspace, request.max_turns, request.prompt)
        events = [event async for event in engine.run(request.prompt)]
        return {"events": [{"kind": event.kind, "payload": event.payload, "at": event.at} for event in events]}
    except (ValueError, RuntimeError, OSError) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


app.mount("/web", StaticFiles(directory=Path(__file__).parent / "web"), name="web")
app.mount("/", StaticFiles(directory=Path(__file__).parent / "web", html=True), name="dashboard")


def main() -> None:
    raw = sys.argv[1:]
    commands = {"run", "web", "telegram", "doctor", "config"}
    if raw and raw[0] not in commands and raw[0] != "--help":
        if "--web" in raw:
            raw = ["web"] + [value for value in raw if value != "--web"]
        elif "--telegram" in raw:
            raw = ["telegram"] + [value for value in raw if value != "--telegram"]
        else:
            raw = ["run"] + raw
    parser = argparse.ArgumentParser(description="Legion local-first autonomous agent harness")
    subparsers = parser.add_subparsers(dest="command")
    run_parser = subparsers.add_parser("run", help="Run one prompt through the agent")
    add_runtime_options(run_parser)
    run_parser.add_argument("prompt")
    web_parser = subparsers.add_parser("web", help="Start the authenticated local HTTP gateway")
    add_runtime_options(web_parser)
    web_parser.add_argument("--port", type=int, default=8787)
    telegram_parser = subparsers.add_parser("telegram", help="Start the Telegram long-polling gateway")
    add_runtime_options(telegram_parser)
    telegram_parser.add_argument("--telegram-token", default=os.getenv("LEGION_TELEGRAM_BOT_TOKEN"))
    telegram_parser.add_argument("--allowed-chat-ids", default=os.getenv("LEGION_TELEGRAM_ALLOWED_CHAT_IDS", ""))
    subparsers.add_parser("doctor", help="Check local runtime prerequisites")
    subparsers.add_parser("config", help="Print effective non-secret configuration")
    args = parser.parse_args(raw)
    logging.basicConfig(level=logging.INFO)
    if args.command == "run":
        apply_runtime_config(args)
        print(BANNER)
        asyncio.run(run_prompt(args.prompt, args.workspace.resolve(), args.max_turns))
    elif args.command == "web":
        apply_runtime_config(args)
        import uvicorn
        app.state.workspace = args.workspace.resolve()
        print(f"LEGION_AUTH_TOKEN={app.state.auth_token}")
        uvicorn.run("legion.main:app", host="127.0.0.1", port=args.port, reload=False)
    elif args.command == "telegram":
        apply_runtime_config(args)
        if args.telegram_token:
            os.environ["LEGION_TELEGRAM_BOT_TOKEN"] = args.telegram_token
        if args.allowed_chat_ids:
            os.environ["LEGION_TELEGRAM_ALLOWED_CHAT_IDS"] = args.allowed_chat_ids
        asyncio.run(run_telegram(args.workspace.resolve(), args.max_turns))
    elif args.command == "doctor":
        raise SystemExit(doctor(Path(__file__).parent.resolve()))
    elif args.command == "config":
        print(json.dumps({"model": os.getenv("LEGION_OLLAMA_MODEL"), "ollama_base_url": os.getenv("LEGION_OLLAMA_BASE_URL", "http://localhost:11434/v1"), "max_turns": int(os.getenv("LEGION_MAX_TURNS", "6")), "telegram_configured": bool(os.getenv("LEGION_TELEGRAM_BOT_TOKEN")), "remote_fallback_configured": bool(os.getenv("LEGION_API_BASE_URL"))}, indent=2))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
