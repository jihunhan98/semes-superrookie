import json
import pytest
from fastapi import HTTPException
import artifact_validation as validation
import artifact_review

class Provider:
    enabled = True
    name = 'test'
    def __init__(self, result): self.result = result
    def generate(self, system, user): self.user = user; return json.dumps(self.result)

def setup_provider(monkeypatch, result):
    provider = Provider(result)
    monkeypatch.setattr(artifact_review, 'provider', provider)
    monkeypatch.setattr(artifact_review, 'parse_json', json.loads)
    return provider

def test_numeric_boundaries_and_units():
    assert validation.numeric_concerns({'value':'SOC 30% 초과'},'SOC 30% 이상')
    assert validation.numeric_concerns({'value':'SOC 0.3% 이상'},'SOC 30% 이상')
    assert not validation.numeric_concerns({'value':'SOC 30% 이상'},'SOC 30% 이상')


def test_evidence_quote_and_field_are_real():
    assert validation.validate_evidence({'overview':'ok','evidence':[{'reqKey':'R','quote':'fake','field':'overview'}]}, {'R':'SOC 30% 이상'})
    assert not validation.validate_evidence({'overview':'SOC 30% 이상','evidence':[{'reqKey':'R','quote':'SOC 30% 이상','field':'overview'}]}, {'R':'SOC 30% 이상'})

def test_coverage_flags_uncovered_text_and_missing_artifacts(monkeypatch):
    setup_provider(monkeypatch,dict(atoms=[dict(quote='SOC 30% 이상',kind='조건',issueIds=[1],artifacts=[],reason='조건')],concerns=[],approved=True))
    result=artifact_review.coverage(artifact_review.CoverageRequest(requirementContent='SOC 30% 이상. 통신 오류 시 재시도.',issues=[{'id':1,'artifacts':[]}]))
    assert not result['approved']
    assert any('통신 오류' in c for c in result['concerns'])


def test_coverage_rejects_fabricated_artifact_evidence(monkeypatch):
    setup_provider(monkeypatch,dict(atoms=[dict(quote='작업 배정',issueIds=[1],artifacts=[dict(issueId=1,type='functional',field='overview',quote='작업 배정')])],concerns=[],approved=True))
    with pytest.raises(HTTPException): artifact_review.coverage(artifact_review.CoverageRequest(requirementContent='작업 배정',issues=[{'id':1,'artifacts':[{'type':'functional','content':{'overview':'다른 내용'}}]}]))

def test_save_revalidates_instead_of_trusting_client_quality():
    from main import ArtifactValidationRequest, validate_artifact
    import artifacts
    content=artifacts.generate_v2('functional','배정','SOC 30% 이상','SOC 30% 이상')
    content['overview']='SOC 0.3% 이상'
    content['evidence']=[dict(field='overview',reqKey='R',quote='SOC 30% 이상')]
    content['legacyExtras']['quality']={'status':'GROUNDED','concerns':[]}
    result=validate_artifact(ArtifactValidationRequest(type='functional',reqKey='R',requirementContent='SOC 30% 이상',content=content))
    assert result['valid'] is False
    assert result['content']['legacyExtras']['quality']['status']=='NEEDS_REVIEW'


def test_removed_routes_are_not_registered():
    import main
    routes = {route.path for route in main.app.routes}
    assert '/impact' not in routes
    assert '/code/index' not in routes
    assert '/coverage' in routes
    assert '/artifacts/validate' in routes


def test_detail_design_can_be_generated_without_source_registration(monkeypatch):
    import main
    import artifacts
    source = 'IDLE 상태의 AMR에 작업을 배정한다.'
    content = artifacts.generate_v2('detail-design', '작업 배정', source, source)
    content.update(description='개념 설계 제안: '+source, classDiagram='classDiagram\n    class MatchingService',
                   sequenceDiagramToBe='sequenceDiagram\n    participant MatchingService\n    Note over MatchingService: 작업 배정')
    content['evidence'] = [dict(field='description', reqKey='REQ03', quote=source)]
    provider = Provider(content)
    monkeypatch.setattr(main, 'PROVIDER', provider)
    result = main.generate_artifact(main.ArtifactGenerateRequest(type='detail-design', reqKey='REQ03',
                issueTitle='작업 배정', issueQuote=source, requirementContent=source))
    assert result.engine == 'test'
    assert result.content['legacyExtras']['quality']['status'] == 'GROUNDED'
    assert 'codeContext' not in provider.user
    assert 'sourceSnapshotId' not in result.content['legacyExtras']
    validated = main.validate_artifact(main.ArtifactValidationRequest(type='detail-design', reqKey='REQ03',
                  requirementContent=source, content=result.content))
    assert validated['valid']
