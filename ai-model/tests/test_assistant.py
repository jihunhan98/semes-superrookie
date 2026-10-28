import json
import pytest
from fastapi import HTTPException
import main

class FakeProvider:
    enabled = True
    name = 'test'
    def generate(self, system, user):
        self.system, self.input = system, json.loads(user)
        return '현재 본문에서 조건을 확인해주세요.'

def test_edit_context_and_history(monkeypatch):
    provider = FakeProvider()
    monkeypatch.setattr(main, 'PROVIDER', provider)
    response = main.assistant(main.AssistantRequest(page='edit', context={'editingContent':'수정한 본문'}, message='조건 검토', history=[{'role':'user','content':'앞선 질문'}]))
    assert response['answer']
    assert provider.input['context']['editingContent'] == '수정한 본문'
    assert provider.input['history'][0]['content'] == '앞선 질문'
    assert '현재 편집 본문' in provider.system
    assert '작업을 실행했다고 말하지 않는다' in provider.system

def test_artifacts_prompt(monkeypatch):
    provider = FakeProvider()
    monkeypatch.setattr(main, 'PROVIDER', provider)
    main.assistant(main.AssistantRequest(page='artifacts', context={}, message='이슈 상태'))
    assert 'Jira 내용을 추정하지 않는다' in provider.system

def test_rule_only_is_explicitly_unavailable(monkeypatch):
    from providers import RuleProvider
    monkeypatch.setattr(main, 'PROVIDER', RuleProvider())
    with pytest.raises(HTTPException) as e:
        main.assistant(main.AssistantRequest(page='project',context={},message='현황'))
    assert e.value.status_code == 503
