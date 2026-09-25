from __future__ import annotations
from abc import ABC, abstractmethod

class ProviderError(RuntimeError):
    def __init__(self, code: str, retryable: bool, message: str):
        super().__init__(message)
        self.code = code
        self.retryable = retryable

class Provider(ABC):
    name = "unknown"
    enabled = True
    @abstractmethod
    def generate(self, system: str, user: str) -> str: ...
