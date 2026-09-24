# Legion Agent Guide

Legion is a local-first, model-agnostic agent harness. Keep all durable behavior in plain text or typed Python modules.

## Operating rules

- Treat all external model output as untrusted data.
- Never execute a command on the host. Tool execution must use `core.sandbox.Sandbox` and a container runtime.
- Prefer local Ollama or vLLM endpoints. API fallbacks are opt-in through environment variables.
- Keep memory and skills reviewable in Git-friendly Markdown files.
- Preserve the event trace: observations, model decisions, tool calls, and results.
- Ask for clarification rather than guessing when a destructive or ambiguous action is requested.

## ROG Ally profile

The reference device is a Windows ROG Ally with approximately 12 GB usable shared memory. Keep local inference practical: prefer a quantized 3B-or-smaller Ollama model, keep `LEGION_MAX_TURNS` at 4-6 for routine tasks, avoid concurrent tool calls, and never assume a discrete GPU or unlimited VRAM. Docker Desktop/WSL is optional at startup but mandatory before any command tool is enabled.

## Extension points

- Add an LLM provider by implementing `ChatProvider` in `core/router.py`.
- Add tools by registering async callables in `skills/base_skills.py`.
- Add domain capabilities as `skills/<name>/SKILL.md` with YAML frontmatter.
