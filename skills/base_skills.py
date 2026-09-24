"""Built-in tool schemas and handlers used by the agent loop."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Awaitable, Callable

from legion.core.sandbox import Sandbox

ToolHandler = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]
MAX_FILE_BYTES = 256 * 1024
MAX_SEARCH_FILES = 500


def tool_definitions() -> list[dict[str, Any]]:
    return [
        {"type": "function", "function": {"name": "read_file", "description": "Read a UTF-8 text file in the workspace", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}}},
        {"type": "function", "function": {"name": "search_files", "description": "Search text files in the workspace", "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}},
        {"type": "function", "function": {"name": "run_command", "description": "Run a shell command inside the Docker sandbox", "parameters": {"type": "object", "properties": {"command": {"type": "string"}}, "required": ["command"]}}},
    ]


def build_handlers(workspace: str | Path, sandbox: Sandbox) -> dict[str, ToolHandler]:
    root = Path(workspace).resolve()

    def safe_path(value: str) -> Path:
        candidate = (root / value).resolve()
        if root not in candidate.parents and candidate != root:
            raise ValueError("Path escapes the workspace")
        return candidate

    async def read_file(arguments: dict[str, Any]) -> dict[str, Any]:
        path = safe_path(str(arguments["path"]))
        if path.stat().st_size > MAX_FILE_BYTES:
            raise ValueError(f"file exceeds the {MAX_FILE_BYTES}-byte read limit")
        return {"path": str(path.relative_to(root)), "content": path.read_text(encoding="utf-8")}

    async def search_files(arguments: dict[str, Any]) -> dict[str, Any]:
        query = str(arguments["query"])
        matches = []
        for path in root.rglob("*"):
            if any(part in {".git", "__pycache__", ".venv"} for part in path.parts):
                continue
            if path.is_file() and path.stat().st_size <= MAX_FILE_BYTES:
                try:
                    if query.lower() in path.read_text(encoding="utf-8").lower():
                        matches.append(str(path.relative_to(root)))
                        if len(matches) >= MAX_SEARCH_FILES:
                            break
                except UnicodeDecodeError:
                    continue
        return {"matches": matches[:100]}

    async def run_command(arguments: dict[str, Any]) -> dict[str, Any]:
        result = await sandbox.run(str(arguments["command"]))
        return {"stdout": result.stdout, "stderr": result.stderr, "exit_code": result.exit_code}

    return {"read_file": read_file, "search_files": search_files, "run_command": run_command}
