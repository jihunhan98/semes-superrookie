from config import Settings
import pytest


def test_settings_read_environment_at_instantiation(monkeypatch):
    # config is imported before main loads .env; read values only afterwards.
    monkeypatch.setenv('AI_PROVIDER', 'internal')
    monkeypatch.setenv('LLM_API_BASE', 'http://example.invalid:6100/v1/')
    monkeypatch.setenv('LLM_API_MODEL', 'local-model')
    monkeypatch.setenv('LLM_API_TIMEOUT', '42')
    settings = Settings()
    settings.validate()
    assert settings.internal_base == 'http://example.invalid:6100/v1'
    assert settings.internal_model == 'local-model'
    assert settings.timeout == 42
    monkeypatch.setenv('LLM_API_BASE', 'http://other.invalid/v1')
    assert Settings().internal_base == 'http://other.invalid/v1'


def test_internal_provider_requires_local_address(monkeypatch):
    monkeypatch.setenv('AI_PROVIDER', 'internal')
    monkeypatch.delenv('LLM_API_BASE', raising=False)
    with pytest.raises(RuntimeError, match='requires LLM_API_BASE'):
        Settings().validate()
