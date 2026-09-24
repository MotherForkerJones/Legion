# Legion

Legion is a local-first, model-agnostic AI agent harness with a Docker-isolated tool layer, Markdown memory and skills, and CLI/webhook gateways.

## Quick start

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:LEGION_OLLAMA_MODEL = "llama3.2:3b"
python -m legion.main "Inspect this workspace and summarize it"
```

### ROG Ally defaults

Legion is tuned for the Windows ROG Ally profile (about 12 GB usable shared memory). Start with a quantized 3B-or-smaller model and 4-6 turns; larger models or long sessions can compete with games, Windows, and Docker's WSL VM for memory.

Ollama is expected at `http://localhost:11434/v1` by default. Override it with `LEGION_OLLAMA_BASE_URL`. API-compatible fallback routing can be configured with `LEGION_API_BASE_URL`, `LEGION_API_MODEL`, and `LEGION_API_KEY`.

## Webhook gateway

```powershell
python -m legion.main --web --port 8787
```

Use `GET /health` or `POST /run` with `{ "prompt": "..." }`.

## Isolation

Commands are refused unless Docker is available. The sandbox uses a disposable container with no network, dropped Linux capabilities, no-new-privileges, resource limits, and a read-only container root. The workspace is mounted at `/workspace`.

## Extending Legion

- Edit [AGENTS.md](AGENTS.md) for durable agent rules.
- Add plain-text memory to [memory/MEMORY.md](memory/MEMORY.md).
- Add `skills/<name>/SKILL.md` files with YAML frontmatter and instructions.
- Implement additional providers or tools in the typed core modules.
