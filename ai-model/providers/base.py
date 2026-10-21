from __future__ import annotations
from abc import ABC, abstractmethod

class ProviderError(RuntimeError):
    def __init__(self, code: str, retryable: bool, message: str, *, stage: str = "generation", upstream_status: int | None = None, parameter: str | None = None):
        super().__init__(message)
        self.code = code
        self.retryable = retryable
        self.stage = stage
        self.upstream_status = upstream_status
        self.parameter = parameter

class Provider(ABC):
    name = "unknown"
    enabled = True
    @abstractmethod
    def generate(self, system: str, user: str) -> str: ...
