import json
import unittest
from unittest.mock import patch

from fastapi import HTTPException

import artifact_validation as validation
import main


SOURCE = '외부 이벤트 메시지를 수신하여 태스크를 생성한다.'


def document(evidence):
    return {
        'overview': '외부 이벤트 기반 태스크 생성',
        'constraintsNote': '별도 품질 수치는 제공된 요구사항에 명시되지 않음',
        'scenarios': [
            {'type': kind, 'precondition': SOURCE, 'scenario': SOURCE, 'postcondition': SOURCE}
            for kind in ('BASIC', 'VARIANT', 'EXCEPTION')
        ],
        'legacyExtras': {},
        'evidence': evidence,
    }


class Provider:
    enabled = True
    name = 'test'

    def __init__(self, documents):
        self.documents = documents
        self.calls = []

    def generate(self, system, user):
        self.calls.append((system, user))
        return json.dumps(self.documents[min(len(self.calls) - 1, len(self.documents) - 1)], ensure_ascii=False)


class ArtifactEvidenceRecoveryTests(unittest.TestCase):
    def test_bracket_and_dot_paths_resolve_to_the_same_field(self):
        for field in ('scenarios[0].precondition', 'scenarios.0.precondition'):
            with self.subTest(field=field):
                content = document([{'field': field, 'reqKey': 'REQ-1', 'quote': SOURCE}])
                self.assertEqual(validation.resolve_evidence_field(content, field), SOURCE)
                self.assertEqual(validation.validate_evidence(content, {'REQ-1': SOURCE}), [])
        self.assertIn('존재하지 않는 산출물 필드', str(validation.validate_evidence(
            document([{'field': 'scenarios[3].precondition', 'reqKey': 'REQ-1', 'quote': SOURCE}]),
            {'REQ-1': SOURCE})))

    def test_wrong_source_id_and_quote_are_retried_once(self):
        corrected = document([{'field': 'scenarios[0].precondition', 'reqKey': 'REQ-1', 'quote': SOURCE}])
        for req_key, quote in (('없는-ID', SOURCE), ('REQ-1', '원문을 바꿔 쓴 구절')):
            with self.subTest(req_key=req_key, quote=quote):
                invalid = document([{'field': 'scenarios[0].precondition', 'reqKey': req_key, 'quote': quote}])
                provider = Provider([invalid, corrected])
                with patch.object(main, 'PROVIDER', provider):
                    result = main.generate_artifact(main.ArtifactGenerateRequest(
                        type='nonfunctional', reqKey='REQ-1', requirementContent=SOURCE,
                        issueTitle='외부 이벤트 기반 생성', issueQuote=SOURCE))
                self.assertEqual(result.content['evidence'], corrected['evidence'])
                self.assertEqual(len(provider.calls), 2)
                self.assertIn('evidence만 수정하세요', provider.calls[1][1])
                self.assertIn('REQ-1', provider.calls[0][1])

    def test_valid_bracket_citation_does_not_trigger_retry(self):
        correct = document([{'field': 'scenarios[0].precondition', 'reqKey': 'REQ-1', 'quote': SOURCE}])
        provider = Provider([correct])
        with patch.object(main, 'PROVIDER', provider):
            result = main.generate_artifact(main.ArtifactGenerateRequest(
                type='nonfunctional', reqKey='REQ-1', requirementContent=SOURCE,
                issueTitle='외부 이벤트 기반 생성', issueQuote=SOURCE))
        self.assertEqual(result.content['evidence'], correct['evidence'])
        self.assertEqual(len(provider.calls), 1)

    def test_persistent_fabricated_quote_still_fails(self):
        invalid = document([{'field': 'overview', 'reqKey': 'REQ-1', 'quote': '원문에 없는 값'}])
        provider = Provider([invalid])
        with patch.object(main, 'PROVIDER', provider):
            with self.assertRaises(HTTPException) as failure:
                main.generate_artifact(main.ArtifactGenerateRequest(
                    type='nonfunctional', reqKey='REQ-1', requirementContent=SOURCE,
                    issueTitle='외부 이벤트 기반 생성', issueQuote=SOURCE))
        self.assertEqual(failure.exception.status_code, 502)
        self.assertEqual(len(provider.calls), 2)


if __name__ == '__main__':
    unittest.main()
