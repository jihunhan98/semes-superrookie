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


def test_model_can_offer_numeric_candidates_only_as_explicit_user_reviewed_proposals():
    rows = review.model_findings({'findings':[{'targetSpan':'응답이 없으면 재시도한다.', 'findingType':'시간·일정 모호',
            'interpretations':'타임아웃 시간이 다르면 재시도 시점이 달라진다.', 'proposals':[{'after':'1초 후 3회 재시도한다.'}]}]}, '응답이 없으면 재시도한다.', [])
    assert rows and rows[0].proposals
    assert "사용자 확인" in rows[0].proposals[0]["label"]
    assert "원문에서 확인된 수치가 아니" in rows[0].interpretations


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


def test_categories_are_five_and_time_is_a_numeric_criterion():
    assert len(main.rules.ALL_TYPES) == 5
    body=analyze('응답이 없으면 재시도한다.')
    assert body['findings'][0]['findingType'] == '수치·판단 기준 불명확'
    assert client.get('/types').json()['types'] == main.rules.ALL_TYPES


def test_unknown_requirement_reference_is_not_detected_in_either_path():
    text='REQ-12에 따라 처리한다.'
    assert not analyze(text)['findings']
    assert not main.rules.detect(text)


def test_old_llm_labels_merge_and_removed_reference_is_ignored(monkeypatch):
    class Provider:
        enabled=True
        name='test'
        def generate(self,*args):
            return json.dumps({'findings':[
                {'findingType':'시간·일정 모호','targetSpan':'응답이 없으면 재시도한다.','interpretations':'대기시간 차이로 재시도 시점이 달라진다.'},
                {'findingType':'참조 요구사항 확인 필요','targetSpan':'REQ-12','reason':'미등록 참조'}]})
    monkeypatch.setattr(main,'PROVIDER',Provider())
    body=analyze('REQ-12에 따라 처리한다. 응답이 없으면 재시도한다.')
    assert body['reviewStatus']=='COMPLETE'
    assert all(f['findingType']=='수치·판단 기준 불명확' for f in body['findings'])


def test_scope_exclusions_do_not_generate_execution_questions():
    text = '스텝 정의 자체의 생성,수정,삭제는 본 문서 범위에서 제외하며, 필요 시 별도로 협의한다.'
    assert review.detect(text) == []
    assert review.model_findings({'findings': [{'findingType': '동작 조건 불명확', 'targetSpan': text, 'reason': '필요 시 조건 누락', 'interpretations': '협의 조건 차이'}]}, text, []) == []


def test_scope_note_does_not_hide_an_operational_issue_in_next_sentence():
    text = '스텝 정의 관리는 본 문서 범위에서 제외한다. 응답이 없으면 재시도한다.'
    findings = review.detect(text)
    assert any('응답' in f.target_span for f in findings)
    assert all('범위' not in f.target_span for f in findings)


def test_successful_contextual_review_does_not_readd_mechanical_fallback_questions(monkeypatch):
    class Provider:
        enabled = True
        name = 'test'
        def generate(self, system, user):
            return '{"terms":[]}' if '핵심 도메인 용어만' in system else '{"findings":[]}'
    monkeypatch.setattr(main, 'PROVIDER', Provider())
    body = analyze('응답이 없으면 재시도한다.')
    assert body['reviewStatus'] == 'COMPLETE'
    assert body['findings'] == []
