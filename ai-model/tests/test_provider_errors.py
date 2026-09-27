import io
import json
import urllib.error
from unittest.mock import patch

import pytest

from providers.base import ProviderError
from providers.gemini import GeminiProvider


class FakeResponse:
    def __enter__(self): return self
    def __exit__(self, *_): return False
    def read(self): return json.dumps({"candidates": [{"content": {"parts": [{"text": "{}"}]}}]}).encode()


def test_gemini_uses_header_not_query_string():
    provider = GeminiProvider("secret-value", "gemini-test", 1)
    with patch("urllib.request.urlopen", return_value=FakeResponse()) as call:
        assert provider.generate("system", "user") == "{}"
    request = call.call_args.args[0]
    assert "secret-value" not in request.full_url
    assert request.headers["X-goog-api-key"] == "secret-value"


@pytest.mark.parametrize("status,retryable", [(401, False), (429, True), (503, True)])
def test_gemini_classifies_http_errors(status, retryable):
    provider = GeminiProvider("secret", "gemini-test", 1)
    error = urllib.error.HTTPError("https://example.invalid", status, "failed", {}, io.BytesIO())
    with patch("urllib.request.urlopen", side_effect=error), pytest.raises(ProviderError) as raised:
        provider.generate("system", "user")
    assert raised.value.code == f"HTTP_{status}"
    assert raised.value.retryable is retryable


def test_gemini_timeout_is_retryable():
    provider = GeminiProvider("secret", "gemini-test", 1)
    with patch("urllib.request.urlopen", side_effect=TimeoutError()), pytest.raises(ProviderError) as raised:
        provider.generate("system", "user")
    assert raised.value.code == "TIMEOUT"
    assert raised.value.retryable is True
