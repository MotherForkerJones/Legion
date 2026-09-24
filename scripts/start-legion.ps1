$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Python = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"
$Ollama = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
$Model = if ($env:LEGION_OLLAMA_MODEL) { $env:LEGION_OLLAMA_MODEL } else { "llama3.2:3b" }
$Port = if ($env:LEGION_PORT) { [int]$env:LEGION_PORT } else { 8787 }

if (-not (Test-Path $Python)) {
    throw "Python 3.12 was not found at $Python"
}
if (-not (Test-Path $Ollama)) {
    throw "Ollama was not found at $Ollama"
}

try {
    docker info *> $null
}
catch {
    throw "Docker Desktop is not ready. Start Docker Desktop and wait for 'docker info' to succeed."
}

$env:LEGION_OLLAMA_MODEL = $Model
$models = & $Ollama list | Out-String
if ($models -notmatch [regex]::Escape($Model)) {
    Write-Host "Pulling $Model for the ROG Ally..."
    & $Ollama pull $Model
}

Set-Location $RepoRoot
Write-Host "Starting Legion at http://127.0.0.1:$Port"
& $Python (Join-Path $RepoRoot "main.py") --web --port $Port
