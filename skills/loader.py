"""Load version-controlled Markdown skills with YAML frontmatter."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True)
class Skill:
    name: str
    description: str
    instructions: str
    metadata: dict[str, Any]

    def as_prompt(self) -> str:
        return f"## Skill: {self.name}\n{self.description}\n\n{self.instructions}"


def parse_skill(path: Path) -> Skill:
    text = path.read_text(encoding="utf-8")
    metadata: dict[str, Any] = {}
    instructions = text
    if text.startswith("---"):
        _, frontmatter, instructions = text.split("---", 2)
        metadata = yaml.safe_load(frontmatter) or {}
    return Skill(path.parent.name, str(metadata.get("description", "")), instructions.strip(), metadata)


class SkillLoader:
    def __init__(self, root: str | Path = "skills") -> None:
        self.root = Path(root)

    def load(self) -> list[Skill]:
        if not self.root.exists():
            return []
        return [parse_skill(path) for path in sorted(self.root.glob("*/SKILL.md"))]

    def relevant_prompt(self, query: str) -> str:
        terms = set(query.lower().split())
        matches = [skill for skill in self.load() if terms.intersection((skill.name + " " + skill.description).lower().split())]
        return "\n\n".join(skill.as_prompt() for skill in matches)
