"""HTTP regressions for immutable issue sources and safe generated-body alignment."""
import json
import pytest
from fastapi.testclient import TestClient
import main
import artifact_review
from providers.base import ProviderError

client = TestClient(main.app)


def body(label='배정'):
    return dict(symptom=None, improvementReq=f'{label} 조건과 완료 기준을 구현한다.',
                changeScope=f'{label} 처리 로직', constraintsNote=None, beforeState=None,
                afterState=f'{label} 처리 결과를 기록한다.')


def payload(count=1):
    sources = [dict(title='AMR 작업 배정', quote='IDLE 상태의 AMR에 작업을 배정한다.'),
               dict(title='충전 처리', quote='SOC 30% 이하이면 충전을 시작한다.')][:count]
    return dict(requirementContent='\n'.join(row['quote'] for row in sources),
                existing=[dict(reqKey='REQ-OTHER', content='통신 오류는 운영자에게 보고한다.')], issues=sources)


class ScriptedProvider:
    enabled = True
    name = 'test'
    def __init__(self, responses):
        self.responses, self.calls = responses, []
    def generate(self, system, user):
        self.calls.append((system, json.loads(user)))
        response = self.responses[min(len(self.calls) - 1, len(self.responses) - 1)]
        if isinstance(response, Exception): raise response
        return response if isinstance(response, str) else json.dumps(response, ensure_ascii=False)


def install(monkeypatch, *responses):
    provider = ScriptedProvider(responses)
    monkeypatch.setattr(artifact_review, 'provider', provider)
    monkeypatch.setattr(artifact_review, 'parse_json', json.loads)
    return provider


def post(value):
    return client.post('/issues/enrich', json=value)


@pytest.mark.parametrize('echo', [dict(title='AI가 다듬은 제목'), dict(quote='AI가 바꾼 인용 문장'),
                                  dict(title='새 제목', quote='다른 구절'), {}])
def test_unchanged_user_input_succeeds_even_if_model_rewrites_identity(monkeypatch, echo):
    req = payload()
    provider = install(monkeypatch, {'issues': [dict(body(), **echo)]})
    response = post(req)
    assert response.status_code == 200, response.text
    row = response.json()['issues'][0]
    assert (row['title'], row['quote']) == (req['issues'][0]['title'], req['issues'][0]['quote'])
    assert row['improvementReq'] == body()['improvementReq']
    assert len(provider.calls) == 1 and 'issueRef' not in row


def test_reordered_batch_uses_server_refs_and_restores_original_identity(monkeypatch):
    req = payload(2)
    install(monkeypatch, {'issues': [dict(body('충전'), issueRef='issue-2', title='충전 90% 이상', quote='없는 문장'),
                                    dict(body('배정'), issueRef='issue-1', title='새 제목', quote='다른 문장')]})
    response = post(req)
    assert response.status_code == 200, response.text
    rows = response.json()['issues']
    assert [(r['title'], r['quote']) for r in rows] == [(s['title'], s['quote']) for s in req['issues']]
    assert [r['changeScope'] for r in rows] == [body('배정')['changeScope'], body('충전')['changeScope']]


def test_legacy_reordering_with_changed_titles_matches_only_unique_quotes(monkeypatch):
    req = payload(2)
    install(monkeypatch, {'issues': [dict(body('충전'), title='새 제목', quote=req['issues'][1]['quote'].replace(' ', '\n')),
                                    dict(body('배정'), quote=req['issues'][0]['quote'])]})
    response = post(req)
    assert response.status_code == 200, response.text
    assert [r['changeScope'] for r in response.json()['issues']] == [body('배정')['changeScope'], body('충전')['changeScope']]


@pytest.mark.parametrize('first', [
    {'issues': [dict(body(), issueRef='issue-1'), dict(body(), issueRef='issue-1')]},
    {'issues': [dict(body(), issueRef='unknown'), dict(body(), issueRef='issue-2')]},
    {'issues': [dict(body(), title='변경된 제목', quote='변경된 구절'), dict(body(), quote='또 다른 구절')]},
    {'issues': [dict(body(), issueRef='issue-1')]}, {}, 'broken JSON',
])
def test_unidentifiable_batch_recovers_per_issue_with_full_context(monkeypatch, first):
    req = payload(2)
    provider = install(monkeypatch, first,
                       {'issues': [dict(body('배정'), title='바뀐 제목', quote='바뀐 구절')]}, body('충전'))
    response = post(req)
    assert response.status_code == 200, response.text
    rows = response.json()['issues']
    assert [r['changeScope'] for r in rows] == [body('배정')['changeScope'], body('충전')['changeScope']]
    assert [(r['title'], r['quote']) for r in rows] == [(s['title'], s['quote']) for s in req['issues']]
    assert len(provider.calls) == 3
    for _, sent in provider.calls:
        assert sent['requirementContent'] == req['requirementContent'] and sent['existing'] == req['existing']
    assert [sent['issues'][0]['quote'] for _, sent in provider.calls[1:]] == [s['quote'] for s in req['issues']]
    assert all(len(sent['issues']) == 1 for _, sent in provider.calls[1:])


@pytest.mark.parametrize('invalid', [dict(improvementReq='있음'), dict(body(), changeScope=' '),
                                     dict(body(), improvementReq=['문자열 아님']),
                                     dict(body(), improvementReq='응답을 10초 대기한다.'), {}])
def test_bad_model_content_is_rejected_as_server_failure_instead_of_user_422(monkeypatch, invalid):
    provider = install(monkeypatch, {'issues': [invalid]})
    response = post(payload())
    assert response.status_code == 502
    detail = response.json()['detail']
    assert detail['code'] == 'ISSUE_ENRICH_INVALID_RESULT'
    assert '선택한 이슈는 유지됩니다' in detail['message'] and '근거가 변경되었습니다' not in detail['message']
    assert len(provider.calls) == 2


def test_empty_model_response_recovers_without_faking_an_empty_body(monkeypatch):
    provider = install(monkeypatch, ProviderError('INVALID_RESPONSE', False, 'empty model response'), {'issues': [body()]})
    response = post(payload())
    assert response.status_code == 200, response.text
    assert len(provider.calls) == 2


@pytest.mark.parametrize('error,status', [(ProviderError('TIMEOUT', True, 'timed out'), 504),
                                          (ProviderError('UNAVAILABLE', True, 'unavailable'), 503), (TimeoutError(), 504)])
def test_provider_failures_have_specific_server_errors(monkeypatch, error, status):
    provider = install(monkeypatch, error)
    response = post(payload())
    assert response.status_code == status
    assert '선택한 이슈는 유지됩니다' in response.json()['detail']['message']
    assert len(provider.calls) == 1


def test_actually_invalid_source_is_422_before_calling_model(monkeypatch):
    provider = install(monkeypatch, {'issues': [body()]})
    req = payload(); req['issues'][0]['quote'] = '확정 요구사항에 없는 문장'
    response = post(req)
    assert response.status_code == 422 and response.json()['detail']['code'] == 'ISSUE_ENRICH_SOURCE'
    assert provider.calls == []


def test_no_issues_needs_no_model_call(monkeypatch):
    provider = install(monkeypatch, {})
    req = payload(); req['issues'] = []
    response = post(req)
    assert response.status_code == 200 and response.json() == {'issues': []}
    assert provider.calls == []
