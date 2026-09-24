"""Fail-closed Docker sandbox for terminal and script execution."""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from pathlib import Path


class SandboxError(RuntimeError):
    """Raised when isolated execution cannot be guaranteed."""


@dataclass
class ExecutionResult:
    stdout: str
    stderr: str
    exit_code: int


class Sandbox:
    """Run commands in a disposable, network-disabled, resource-limited container."""

    def __init__(self, image: str = "python:3.12-slim", workspace: str | Path = ".", timeout: float = 30.0) -> None:
        self.image = image
        self.workspace = Path(workspace).resolve()
        self.timeout = timeout

    async def run(self, command: str, *, timeout: float | None = None) -> ExecutionResult:
        if not command.strip():
            raise SandboxError("Refusing to execute an empty command")
        if not self.workspace.is_dir():
            raise SandboxError(f"Workspace does not exist: {self.workspace}")
        docker = os.getenv("LEGION_DOCKER_BIN", "docker")
        args = [docker, "run", "--rm", "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "128", "--memory", "512m", "--cpus", "1", "-v", f"{self.workspace}:/workspace:rw", "-w", "/workspace", self.image, "sh", "-lc", command]
        try:
            process = await asyncio.create_subprocess_exec(*args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        except OSError as exc:
            raise SandboxError("Docker is unavailable; refusing host execution") from exc
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout or self.timeout)
        except asyncio.TimeoutError:
            process.kill()
            await process.communicate()
            raise SandboxError(f"Command exceeded sandbox timeout ({timeout or self.timeout}s)")
        return ExecutionResult(stdout.decode(errors="replace"), stderr.decode(errors="replace"), process.returncode or 0)
