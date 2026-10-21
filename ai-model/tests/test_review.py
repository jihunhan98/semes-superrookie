import json
from fastapi.testclient import TestClient
import main, review

client = TestClient(main.app)


def analyze(text, existing=None):
    response = client.post('/analyze', json={'content': text, 'existing': existing or []})
    assert response.status_code == 200, response.text
    return response.json()


def test_heading_and_plain_conjunctions_are_not_findings():
    for text in ['2. 스텝 전환 조건 및 예외 처리', '로그 및 알람을 기록한다.', 'A 및 B가 모두 충족되면 전환한다.']:
        assert analyze(text)['findings'] == []


def test_real_logical_ambiguity_has_two_precise_opt_in_alternatives():
    text = 'A 또는 B 및 C이면 다음 스텝으로 전환한다.'
    body = analyze(text)
    assert body['draftContent'] == text
    finding = body['findings'][0]
    assert len(finding['proposals']) == 2
    assert finding['proposals'][0]['after'] == '(A 또는 B) 그리고 C이면 다음 스텝으로 전환한다.'
    assert finding['proposals'][1]['after'] == 'A 또는 (B 그리고 C)이면 다음 스텝으로 전환한다.'
    assert finding['severity'] == 'ADVISORY'


def test_missing_policy_has_visible_placeholders_and_no_fabricated_numbers():
    text = '응답이 없으면 재시도한다.'
    body = analyze(text)
    proposal = body['findings'][0]['proposals'][0]
    assert proposal['needsInput']
    assert '⟦응답 대기시간(ms): 입력 필요⟧' in proposal['after']
    assert not any(c.isdigit() for c in proposal['after'])
    assert body['draftContent'] == text


def test_shared_policy_and_valid_reference_prevent_repeated_missing_timing():
    assert not analyze('응답 대기시간은 100ms이다. 응답이 없으면 재시도한다.')['findings']
    assert not analyze('REQ-03에 따라 주기적으로 상태를 보고한다.', [{'reqKey': 'REQ-03', 'content': '상태 보고 주기는 10초이다.'}])['findings']


def test_full_document_and_all_existing_are_sent_in_revision(monkeypatch):
    class Provider:
        enabled = True
        name = 'test'
        def generate(self, system, user):
            assert '2. 스텝 전환 조건 및 예외 처리' in user
            assert '변경 전 본문 전체' in user
            for i in range(7): assert f'REQ-{i}' in user
            return '{"findings":[]}'
    monkeypatch.setattr(main, 'PROVIDER', Provider())
    body = client.post('/analyze', json={'content':'2. 스텝 전환 조건 및 예외 처리\n새 동작을 수행한다.', 'baseContent': '기존 동작을 수행한다.',
            'existing': [{'reqKey':f'REQ-{i}', 'content':f'기존 정책 {i}'} for i in range(7)]}).json()
    assert body['scope'] == 'full-context'
    assert body['reviewStatus'] == 'COMPLETE'
    assert body['reviewedCount'] == 7


def test_same_soc_policy_conflict_but_not_matching_vs_charging():
    old = {'reqKey':'REQ-03', 'content':'작업 매칭 시 SOC 50% 이상인 AMR만 후보에 포함한다.', 'state':'CONFIRMED'}
    f = analyze('작업 매칭 시 SOC 30% 이상인 AMR만 후보에 포함한다.', [old])['findings'][0]
    assert f['severity'] == 'BLOCKING'
    assert f['conflictQuote'] == old['content']
    assert '50%' in f['proposals'][0]['after']
    assert not analyze('충전 시작 기준은 SOC 30% 이하로 설정한다.', [old])['findings']
    old['state'] = 'RECEIVED'
    assert analyze('작업 매칭 시 SOC 30% 이상인 AMR만 후보에 포함한다.', [old])['findings'][0]['severity'] == 'ADVISORY'


def test_utf16_ranges_identify_one_occurrence_even_after_emoji():
    text = '😀 상태 표시\n응답이 없으면 재시도한다.'
    p = analyze(text)['findings'][0]['proposals'][0]
    encoded = text.encode('utf-16-le')
    assert encoded[p['start']*2:p['end']*2].decode('utf-16-le') == p['before']
    assert p['start'] == len('😀 상태 표시\n'.encode('utf-16-le')) // 2


def test_llm_failure_is_distinct_from_success(monkeypatch):
    class Provider:
        enabled = True
        name = 'test'
        def generate(self, *args): raise TimeoutError()
    monkeypatch.setattr(main, 'PROVIDER', Provider())
    body = analyze('정상 상태를 표시한다.')
    assert body['reviewStatus'] == 'PARTIAL'
    assert body['engine'] == 'rule'


def test_bad_llm_location_is_not_executable_and_is_reported(monkeypatch):
    class Provider:
        enabled = True
        name = 'test'
        def generate(self, *args):
            return json.dumps({'findings':[{'targetSpan':'없는 문장', 'findingType':'시간·일정 모호', 'interpretations':'결과 차이'}]})
    monkeypatch.setattr(main, 'PROVIDER', Provider())
    body = analyze('정상 상태를 표시한다.')
    assert not body['findings']
    assert body['reviewStatus'] == 'PARTIAL'


def test_model_cannot_insert_unfounded_numeric_policy():
    rows = review.model_findings({'findings':[{'targetSpan':'응답이 없으면 재시도한다.', 'findingType':'시간·일정 모호',
            'interpretations':'타임아웃 시간이 다르면 재시도 시점이 달라진다.', 'proposals':[{'after':'1초 후 3회 재시도한다.'}]}]}, '응답이 없으면 재시도한다.', [])
    assert rows and not rows[0].proposals


def test_existing_batches_are_complete_not_truncated(monkeypatch):
    calls = []
    class Provider:
        enabled = True
        name = 'test'
        def generate(self, system, user): calls.append(user); return '{"findings":[]}'
    monkeypatch.setattr(main, 'PROVIDER', Provider())
    rows = [{'reqKey':f'REQ-{i}', 'content':'기준 내용 '*5000} for i in range(4)]
    body = analyze('서버는 상태를 표시한다.', rows)
    assert len(calls) >= 2 and body['reviewedCount'] == 4
    assert all(any(f'REQ-{i}' in call for call in calls) for i in range(4))


def test_distinct_missing_criteria_in_same_sentence_are_not_lost():
    body=analyze('AMR 매칭 시 가용한 AMR 중 가장 가까운 AMR을 선택한다.')
    reasons=' '.join(f['reason'] for f in body['findings'])
    assert '가용' in reasons and '거리를' in reasons
    assert len(body['findings']) >= 3
