"""The impact gate must never treat an incomplete AI reply as no changes."""
import json
import sys
import unittest
from pathlib import Path
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import artifact_review


class Provider:
    enabled = True
    name = 'test'

    def __init__(self, output):
        self.output = output
        self.input = None

    def generate(self, system, user):
        self.input = user
        return json.dumps(self.output)


class ImpactTest(unittest.TestCase):
    def setUp(self):
        self.provider_before = artifact_review.provider
        self.parser_before = artifact_review.parse_json
        artifact_review.parse_json = json.loads
        self.request = artifact_review.ImpactRequest(
            oldContent='속도는 10이다.\n안전 확인을 한다.',
            newContent='속도는 12이다.\n안전 확인을 한다.',
            issues=[{'id': 7, 'title': '주행', 'quote': '속도는 12이다.', 'artifacts': [
                {'type': 'functional', 'content': {'scenario': '속도 10'}},
                {'type': 'voc', 'content': {'request': '주행'}}]}])

    def tearDown(self):
        artifact_review.provider = self.provider_before
        artifact_review.parse_json = self.parser_before

    def test_per_document_decision_receives_change_and_existing_content(self):
        provider = Provider({'impacts': [
            {'issueId': 7, 'type': 'functional', 'affected': True, 'reason': '속도 변경'},
            {'issueId': 7, 'type': 'voc', 'affected': False, 'reason': '개요 유지'}]})
        artifact_review.provider = provider
        result = artifact_review.artifact_impact(self.request)
        self.assertEqual(2, len(result['impacts']))
        self.assertIn('속도 10', provider.input)
        self.assertIn('속도는 12이다.', provider.input)

    def test_missing_document_decision_is_rejected(self):
        artifact_review.provider = Provider({'impacts': [
            {'issueId': 7, 'type': 'functional', 'affected': False}]})
        with self.assertRaises(HTTPException) as error:
            artifact_review.artifact_impact(self.request)
        self.assertEqual(422, error.exception.status_code)


if __name__ == '__main__':
    unittest.main()
