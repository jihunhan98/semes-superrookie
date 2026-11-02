"""LLM review requests must generate the same contract the validator accepts."""
import json

import pytest
from fastapi.testclient import TestClient
import main
import review

TEXT = '😀 상태 표시\r\n서버는 응답이 없으면 재시도한다.'
SOURCE = '서버는 응답이 없으면 재시도한다.'


def input_json(user):
    return json.JSONDecoder().raw_decode(user.split('\n', 1)[1])[0]


def model_row(target_id=None, **changes):
    row = {'findingType': main.rules.T_QUANT, 'reason': '응답 대기시간이 정해지지 않았습니다.',
        'suggestion': '대기시간 후보를 확인해주세요.',
        'interpretations': '대기시간에 따라 재시도 시점이 달라집니다.',
        'proposals': [{'label': '대기시간 제안', 'operation': 'REPLACE', 'after': '서버는 1초 이내에 응답이 없으면 재시도한다.'}]}
    if target_id is not None:
        row['targetId'] = target_id
    return dict(row, **changes)


def test_prompt_json_example_contains_one_real_type_and_one_real_operation():
    start = main._SYSTEM_PROMPT.index('{"findings":[{')
    example = json.JSONDecoder().raw_decode(main._SYSTEM_PROMPT[start:])[0]
    row = example['findings'][0]
    assert row['findingType'] in main.rules.ALL_TYPES
    assert row['proposals'][0]['operation'] in ('REPLACE', 'INSERT_BEFORE', 'INSERT_AFTER', 'DELETE')
    assert '|' not in row['findingType'] and '|' not in row['proposals'][0]['operation']
    assert 'targetId' in row and 'targetSpan' not in row
    assert 'findings에 객체를 두 개' in main._SYSTEM_PROMPT
    for category in main.rules.ALL_TYPES:
        assert category in main._SYSTEM_PROMPT


def test_review_input_separates_current_source_from_all_references():
    existing = [{'reqKey': f'REQ-{i}', 'content': f'기존 원문 {i}'} for i in range(17)]
    targets = review.source_targets(TEXT)
    data = input_json(main._review_user_msg(TEXT, '추가 검토', existing, targets, '변경 전 본문'))
    assert data['currentRequirement'] == TEXT
    assert data['existingRequirements'] == existing
    assert data['변경 전 본문 전체'] == '변경 전 본문'
    assert data['reason'] == '추가 검토'
    assert data['targetSpans'] == targets
    assert any(target['text'] == SOURCE for target in targets)


@pytest.mark.parametrize('text', [TEXT, '서버는 ' + '처리 조건 ' * 150 + '처리한다.', '동일 동작을 수행한다.\n서버는 상태를 표시한다.\n동일 동작을 수행한다.'])
def test_targets_are_bounded_exact_slices_of_unchanged_source(text):
    targets = review.source_targets(text)
    assert targets and len({t['targetId'] for t in targets}) == len(targets)
    assert all(t['text'] in text and 0 < len(t['text']) <= 500 for t in targets)
    assert all(text.count(t['text']) == 1 for t in targets)


def test_known_id_resolves_source_without_asking_model_to_retype_it():
    targets = review.source_targets(TEXT)
    target = next(t for t in targets if t['text'] == SOURCE)
    raw = {'findings': [model_row(target['targetId'], targetSpan='서버는 응답이 없는 경우 다시 시도한다.')]}
    prepared = review.bind_source_targets(raw, targets, TEXT, [])
    assert prepared['findings'][0]['targetSpan'] == SOURCE
    review.validate_findings(prepared, TEXT, [])
    result = review.model_findings(prepared, TEXT, [])[0].to_dict()
    assert result['targetSpan'] == SOURCE
    assert result['proposals'][0]['before'] == SOURCE
    assert TEXT.encode('utf-16-le')[result['spanStart']*2:result['spanEnd']*2].decode('utf-16-le') == SOURCE


def test_unknown_id_cannot_fall_back_to_model_quote_or_nearby_source():
    with pytest.raises(review.FindingValidationError) as error:
        review.bind_source_targets({'findings': [model_row('T9999', targetSpan=SOURCE)]}, review.source_targets(TEXT), TEXT, [])
    assert error.value.issues[0]['code'] == 'TARGET_ID_UNKNOWN'
    assert error.value.findings == []


def test_unknown_id_retains_other_valid_grounded_findings():
    targets = review.source_targets(TEXT)
    target = next(t for t in targets if t['text'] == SOURCE)
    with pytest.raises(review.FindingValidationError) as error:
        review.bind_source_targets({'findings': [model_row(target['targetId']), model_row('T9999')]}, targets, TEXT, [])
    assert len(error.value.findings) == 1
    assert error.value.findings[0].target_span == SOURCE
    assert error.value.issues[0]['findingIndex'] == 2


def test_legacy_quote_still_requires_exact_match_and_single_enum():
    targets = review.source_targets(TEXT)
    for changes in [{'targetSpan': '없는 원문'}, {'targetSpan': SOURCE, 'findingType': '동작 조건 불명확|예외 처리 누락'}]:
        prepared = review.bind_source_targets({'findings': [model_row(**changes)]}, targets, TEXT, [])
        with pytest.raises(review.FindingValidationError):
            review.validate_findings(prepared, TEXT, [])


def test_id_based_review_finishes_all_17_comparisons_with_two_single_type_findings(monkeypatch):
    class Provider:
        enabled = True
        name = 'test'
        def generate(self, system, user):
            if '핵심 도메인 용어만' in system:
                return '{"terms":[]}'
            data = input_json(user)
            assert data['currentRequirement'] == TEXT
            assert len(data['existingRequirements']) == 17
            target = next(t for t in data['targetSpans'] if t['text'] == SOURCE)
            return json.dumps({'findings': [
                model_row(target['targetId'], findingType=main.rules.T_WHEN),
                model_row(target['targetId'], findingType=main.rules.T_BOUNDARY, reason='실패 시 동작 누락'),
            ]})
    monkeypatch.setattr(main, 'PROVIDER', Provider())
    response = TestClient(main.app).post('/analyze', json={'content': TEXT,
        'existing': [{'reqKey': f'REQ-{i}', 'content': f'기존 요구사항 {i}'} for i in range(17)]})
    assert response.status_code == 200
    body = response.json()
    assert body['reviewStatus'] == 'COMPLETE' and body['reviewedCount'] == 17
    assert body['reviewWarnings'] == []
    assert {f['findingType'] for f in body['findings']} == {main.rules.T_WHEN, main.rules.T_BOUNDARY}
    assert all(f['targetSpan'] == SOURCE and f['proposals'][0]['before'] == SOURCE for f in body['findings'])


@pytest.mark.parametrize('invalid,code', [
    ({'targetSpan': '서버는 응답이 없는 경우 다시 시도한다.'}, 'TARGET_SPAN_NOT_FOUND'),
    ({'targetSpan': SOURCE, 'findingType': '동작 조건 불명확 | 예외 처리 누락'}, 'FINDING_TYPE_UNSUPPORTED'),
    ({'targetSpan': SOURCE, 'proposals': [{'operation': 'REPLACE|INSERT_AFTER', 'after': '새 문장'}]}, 'NO_VALID_PROPOSALS'),
    ({'targetId': 'T9999'}, 'TARGET_ID_UNKNOWN'),
])
def test_retry_returns_precise_error_and_recovers_using_same_source_context(monkeypatch, invalid, code):
    calls = []
    class Provider:
        enabled = True
        name = 'test'
        def generate(self, system, user):
            if '핵심 도메인 용어만' in system:
                return '{"terms":[]}'
            calls.append((system, user))
            if len(calls) == 1:
                return json.dumps({'findings': [model_row(**invalid)]})
            assert code in system
            assert user == calls[0][1]
            data = input_json(user)
            target = next(t for t in data['targetSpans'] if t['text'] == SOURCE)
            return json.dumps({'findings': [model_row(target['targetId'])]})
    monkeypatch.setattr(main, 'PROVIDER', Provider())
    body = TestClient(main.app).post('/analyze', json={'content': TEXT}).json()
    assert len(calls) == 2
    assert body['reviewStatus'] == 'COMPLETE' and body['reviewWarnings'] == []
    assert body['findings'][0]['targetSpan'] == SOURCE


def test_repeated_wrong_ids_remain_partial_instead_of_reporting_false_success(monkeypatch):
    class Provider:
        enabled = True
        name = 'test'
        def generate(self, system, user):
            return '{"terms":[]}' if '핵심 도메인 용어만' in system else json.dumps({'findings': [model_row('T9999')]})
    monkeypatch.setattr(main, 'PROVIDER', Provider())
    body = TestClient(main.app).post('/analyze', json={'content': TEXT}).json()
    assert body['reviewStatus'] == 'PARTIAL' and body['reviewWarnings'] == ['INVALID_FINDING']


def test_binding_errors_keep_original_response_item_numbers_in_diagnostics():
    targets = review.source_targets(TEXT)
    raw = {'findings': [model_row('T9999'), model_row(targetSpan='없는 문장')]}
    with pytest.raises(review.FindingValidationError) as raised:
        review.bind_source_targets(raw, targets, TEXT, [])
    assert [(i['findingIndex'], i['code']) for i in raised.value.issues] == [
        (1, 'TARGET_ID_UNKNOWN'), (2, 'TARGET_SPAN_NOT_FOUND')]
