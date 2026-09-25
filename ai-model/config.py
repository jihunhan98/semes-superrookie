from __future__ import annotations
import os
from dataclasses import dataclass

@dataclass(frozen=True)
class Settings:
    provider: str = os.getenv("AI_PROVIDER", "rule").strip().lower()
    internal_base: str = os.getenv("LLM_API_BASE", "").strip().rstrip("/")
    internal_model: str = os.getenv("LLM_API_MODEL", "gpt-4").strip()
    internal_key: str = os.getenv("LLM_API_KEY", "EMPTY")
    gemini_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    timeout: float = float(os.getenv("LLM_API_TIMEOUT", "90"))

    def validate(self) -> None:
        if self.provider not in {"rule", "internal", "gemini"}:
            raise RuntimeError("AI_PROVIDER must be rule, internal, or gemini")
        if self.provider == "internal" and not self.internal_base:
            raise RuntimeError("AI_PROVIDER=internal requires LLM_API_BASE")
        if self.provider == "gemini" and not self.gemini_key:
            raise RuntimeError("AI_PROVIDER=gemini requires GEMINI_API_KEY")
