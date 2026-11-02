"""Diagnostic coverage: rejection policy and API result remain unchanged."""
import json
import logging

import pytest
from fastapi.testclient import TestClient
import main
import review

TEXT = '서버는 응답이 없으면 재시도한다.'
OTHER = {'reqKey': 'REQ-01', 'content': '서버는 1초 후 재시도한다.', 'state': 'CONFIRMED'}


def finding(**changes):
    return dict({'findingType': main.rules.T_TIME, 'targetSpan': TEXT,
        'reason': '대기시간 누락', 'interpretations': '대기시간에 따라 결과가 달라진다.',
        'proposals': [{'after': '서버는 1초 후 재시도한다.'}]}, **changes)


@pytest.mark.parametrize('row,content,existing,code', [
    (None, TEXT, [], 'FINDING_NOT_OBJECT'),
    (finding(targetSpan=None), TEXT, [], 'TARGET_SPAN_NOT_STRING'),
    (finding(targetSpan=''), TEXT, [], 'TARGET_SPAN_EMPTY'),
    (finding(targetSpan='없는 문장'), TEXT, [], 'TARGET_SPAN_NOT_FOUND'),
    (finding(targetSpan='서버는 ' + '처리 기준 ' * 100 + '처리한다.'), '서버는 ' + '처리 기준 ' * 100 + '처리한다.', [], 'TARGET_SPAN_TOO_LONG'),
    (finding(), TEXT + '\n' + TEXT, [], 'TARGET_SPAN_NOT_UNIQUE'),
    (finding(interpretations=''), TEXT, [], 'INTERPRETATIONS_MISSING'),
    (finding(proposals=None), TEXT, [], 'PROPOSALS_NOT_ARRAY'),
    (finding(proposals=['문장']), TEXT, [], 'PROPOSAL_NOT_OBJECT'),
    (finding(findingType='지원하지 않는 유형'), TEXT, [], 'FINDING_TYPE_UNSUPPORTED'),
    (finding(conflictReqKey='REQ-99', conflictQuote='원문'), TEXT, [OTHER], 'CONFLICT_REQUIREMENT_NOT_IN_BATCH'),
    (finding(conflictReqKey='REQ-01'), TEXT, [OTHER], 'CONFLICT_QUOTE_MISSING'),
    (finding(conflictReqKey='REQ-01', conflictQuote='없는 인용'), TEXT, [OTHER], 'CONFLICT_QUOTE_NOT_FOUND'),
    (finding(findingType=main.rules.T_CONFLICT), TEXT, [OTHER], 'CONFLICT_REQUIREMENT_MISSING'),
    (finding(findingType=main.rules.T_CONFLICT, conflictReqKey='REQ-01', conflictQuote=OTHER['content']), TEXT, [OTHER], 'CONFLICT_SAME_CONDITION_MISSING'),
    (finding(options=None), TEXT, [], 'MODEL_FINDING_EXCEPTION'),
])
def test_each_original_rejection_has_specific_reason(row, content, existing, code):
    with pytest.raises(review.FindingValidationError) as raised:
        review.validate_findings({'findings': [row]}, content, existing)
    assert code in [issue['code'] for issue in raised.value.issues]
    assert raised.value.issues[0]['findingIndex'] == 1
    assert str(raised.value) == 'INVALID_FINDING'


@pytest.mark.parametrize('proposal,reason', [
    ({'operation': 'UPDATE', 'after': '새 문장'}, 'PROPOSAL_OPERATION_UNSUPPORTED'),
    ({'after': ' '}, 'PROPOSAL_AFTER_EMPTY'),
    ({'after': '가' * 6001}, 'PROPOSAL_AFTER_TOO_LONG'),
])
def test_proposal_rejection_reports_exact_field(proposal, reason):
    with pytest.raises(review.FindingValidationError) as raised:
        review.validate_findings({'findings': [finding(proposals=[proposal])]}, TEXT, [])
    issue = raised.value.issues[0]
    assert issue['code'] == 'NO_VALID_PROPOSALS'
    assert issue['proposals'][0]['code'] == reason
    assert issue['proposals'][0]['proposalIndex'] == 1


def test_whitespace_diagnosis_does_not_relax_exact_matching():
    span = '서버는 응답이\n없으면 재시도한다.'
    with pytest.raises(review.FindingValidationError) as raised:
        review.validate_findings({'findings': [finding(targetSpan=span)]}, TEXT, [])
    issue = raised.value.issues[0]
    assert issue['code'] == 'TARGET_SPAN_NOT_FOUND'
    assert issue['matchesIgnoringWhitespace'] is True
    assert issue['exactOccurrences'] == 0
    assert issue['closestSourcePreview'] == TEXT


def test_api_reproduces_original_zero_of_17_with_matching_span_but_missing_explanation(monkeypatch, caplog):
    class Provider:
        enabled = True
        name = 'test'
        def generate(self, system, user):
            if '핵심 도메인 용어만' in system:
                return '{"terms":[]}'
            return json.dumps({'findings': [finding(interpretations='')]})
    monkeypatch.setattr(main, 'PROVIDER', Provider())
    with caplog.at_level(logging.INFO, logger='ai-model'):
        response = TestClient(main.app).post('/analyze', json={
            'content': TEXT,
            'existing': [{'reqKey': f'REQ-{i:02}', 'content': f'기존 정책 {i}'} for i in range(17)],
        })
    assert response.status_code == 200
    body = response.json()
    assert body['reviewStatus'] == 'PARTIAL' and body['reviewedCount'] == 0
    assert body['reviewWarnings'] == ['INVALID_FINDING']
    lines = [record.getMessage() for record in caplog.records]
    assert any('existingCount=17' in line and 'AI review started' in line for line in lines)
    rejected = [line for line in lines if 'AI review finding rejected' in line]
    assert len(rejected) == 2
    assert 'attempt=1 finding=1 code=INTERPRETATIONS_MISSING' in rejected[0]
    assert 'attempt=2 finding=1 code=INTERPRETATIONS_MISSING' in rejected[1]
    assert all('batch=1' in line and TEXT in line for line in rejected)
    assert any('comparedCount=0/17' in line and 'status=PARTIAL' in line for line in lines)


def test_valid_findings_still_survive_invalid_row_and_attempt_logs_identify_row(caplog):
    rows = {'findings': [finding(), finding(targetSpan='없는 문장')]}
    class Provider:
        def generate(self, *_): return json.dumps(rows)
    with caplog.at_level(logging.WARNING, logger='ai-model.review'):
        with pytest.raises(review.FindingValidationError) as raised:
            review.generate_findings(Provider(), 'system', 'user', json.loads,
                lambda raw: review.validate_findings(raw, TEXT, []),
                diagnostic_context={'analysisId': 'trace-123', 'batch': 2})
    assert len(raised.value.findings) == 1
    assert raised.value.findings[0].target_span == TEXT
    messages = [r.getMessage() for r in caplog.records]
    assert len(messages) == 2
    assert all('analysisId=trace-123 batch=2' in message and 'finding=2 code=TARGET_SPAN_NOT_FOUND' in message for message in messages)


def test_diagnostic_previews_are_bounded_and_newlines_are_json_escaped(caplog):
    rows = {'findings': [finding(targetSpan='없는\n문장' + '가' * 10000)]}
    class Provider:
        def generate(self, *_): return json.dumps(rows)
    with caplog.at_level(logging.WARNING, logger='ai-model.review'):
        with pytest.raises(review.FindingValidationError):
            review.generate_findings(Provider(), 'system', 'user', json.loads,
                lambda raw: review.validate_findings(raw, TEXT, []))
    messages = [r.getMessage() for r in caplog.records]
    assert all(len(message) < 1200 for message in messages)
    assert all('없는\\n문장' in message and '없는\n문장' not in message for message in messages)
