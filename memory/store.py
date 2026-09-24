"""Markdown-backed memory with a small SQLite FTS5 retrieval index."""

from __future__ import annotations

import re
import sqlite3
from pathlib import Path


class MemoryStore:
    def __init__(self, markdown_path: str | Path = "memory/MEMORY.md", database_path: str | Path = "memory/memory.sqlite3") -> None:
        self.markdown_path = Path(markdown_path)
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.execute("CREATE VIRTUAL TABLE IF NOT EXISTS memories USING fts5(section, content)")

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.database_path)

    def rebuild_index(self) -> None:
        text = self.markdown_path.read_text(encoding="utf-8") if self.markdown_path.exists() else ""
        sections = re.split(r"(?m)^##+\s+", text)
        with self._connect() as connection:
            connection.execute("DELETE FROM memories")
            connection.executemany("INSERT INTO memories(section, content) VALUES (?, ?)", [(part[:80].strip(), part.strip()) for part in sections if part.strip()])

    def search(self, query: str, limit: int = 5) -> list[str]:
        with self._connect() as connection:
            rows = connection.execute("SELECT content FROM memories WHERE memories MATCH ? LIMIT ?", (query, limit)).fetchall()
        return [row[0] for row in rows]

    def append(self, section: str, content: str) -> None:
        with self.markdown_path.open("a", encoding="utf-8") as file:
            file.write(f"\n## {section}\n\n{content.strip()}\n")
        self.rebuild_index()
