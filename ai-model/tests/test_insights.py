import copy
import json
import pytest
from fastapi import HTTPException
import grounding
import insights

class Provider:
    enabled=True
    name='test'
    def __init__(self,result): self.result=result
    def generate(self,system,user): self.user=user;return json.dumps(self.result)

def setup_provider(monkeypatch,result):
    p=Provider(result);monkeypatch.setattr(insights,'provider',p);monkeypatch.setattr(insights,'parse_json',json.loads);return p

@pytest.mark.parametrize('path,source,name,method',[
 ('Battery.cpp','class Battery { public: bool ready() { return soc >= 30; } int soc; };','Battery','ready'),
 ('Battery.java','package vcs; class Battery { boolean ready() { return true; }}','vcs.Battery','ready'),
 ('Battery.cs','class Battery { public bool Ready() { return true; }}','Battery','Ready'),
 ('Battery.py','class Battery:\n    def ready(self):\n        return True\n','Battery','ready')])
def test_real_source_symbols(path,source,name,method):
    r=grounding.index_sources([dict(path=path,content=source)],'v1')
    assert r['symbols'][0]['qualifiedName']==name
    assert r['symbols'][0]['methods'][0]['name']==method
    assert r['symbols'][0]['line']==1


def test_cpp_header_and_external_definition_any_order():
    r=grounding.index_sources([dict(path='Battery.cpp',content='bool Battery::ready() { return true; }'),dict(path='Battery.h',content='class Battery { public: bool ready(); };')],'v1')
    assert any(m['file']=='Battery.cpp' for m in r['symbols'][0]['methods'])


def test_untrusted_paths_and_context_limits(monkeypatch):
    with pytest.raises(ValueError): grounding.index_sources([dict(path='../x.py',content='class X: pass')],'v1')
    monkeypatch.setattr(grounding,'MAX_CONTEXT',10)
    with pytest.raises(ValueError,match='생략하지'): grounding.checked_context({'requirements':'all must be present'})


def test_diagram_unknown_class_and_method_rejected():
    snapshot=grounding.index_sources([dict(path='B.py',content='class Battery:\n def ready(self): return True')],'v1')
    sid=snapshot['symbols'][0]['id']
    with pytest.raises(ValueError,match='클래스'): grounding.render_design({'diagramModel':{'classIds':['fake']}},snapshot)
    with pytest.raises(ValueError,match='메서드'): grounding.render_design({'diagramModel':{'classIds':[sid],'after':[{'from':sid,'to':sid,'methodId':'fake'}]}},snapshot)


def test_rendered_class_name_is_actual_name():
    snapshot=grounding.index_sources([dict(path='B.py',content='class Battery:\n def ready(self): return True')],'v1')
    s=snapshot['symbols'][0]
    result=grounding.render_design({'diagramModel':{'classIds':[s['id']],'after':[{'from':s['id'],'to':s['id'],'methodId':s['methods'][0]['id'],'reason':'SOC 기준 30%로 변경'}]}},snapshot)
    assert 'Battery' in result['classDiagram']
    assert 'ready()' in result['sequenceDiagramToBe']
    assert result['legacyExtras']['codeEvidence'][0]['file']=='B.py'


def test_numeric_boundaries_and_units():
    assert grounding.numeric_concerns({'value':'SOC 30% 초과'},'SOC 30% 이상')
    assert grounding.numeric_concerns({'value':'SOC 0.3% 이상'},'SOC 30% 이상')
    assert not grounding.numeric_concerns({'value':'SOC 30% 이상'},'SOC 30% 이상')


def test_evidence_quote_and_field_are_real():
    assert grounding.validate_evidence({'overview':'ok','evidence':[{'reqKey':'R','quote':'fake','field':'overview'}]}, {'R':'SOC 30% 이상'})
    assert not grounding.validate_evidence({'overview':'SOC 30% 이상','evidence':[{'reqKey':'R','quote':'SOC 30% 이상','field':'overview'}]}, {'R':'SOC 30% 이상'})


def impact_request():
    return insights.ImpactRequest(reqKey='A',before='SOC 50% 이상 배정',after='SOC 30% 이상 배정',requirements=[dict(reqKey='A',content='SOC 30% 이상 배정'),dict(reqKey='B',content='SOC 50% 이상 후보 선정')])

def test_impact_values_and_full_input(monkeypatch):
    result={'summary':'배정 SOC 하향','decisions':[dict(reqKey='B',judgment='IMPACT',targetQuote='SOC 50% 이상 후보 선정',beforeValue='50%',afterValue='30%',reason='30~50% 후보가 기존 필터에 의해 제외됨',suggestion='후보 조건 확인')]}
    p=setup_provider(monkeypatch,result)
    assert insights.impact(impact_request())['decisions'][0]['afterValue']=='30%'
    assert 'SOC 50% 이상 후보 선정' in p.user
    result['decisions'][0]['afterValue']='20%'
    with pytest.raises(HTTPException): insights.impact(impact_request())


def test_impact_missing_decision_is_not_no_impact(monkeypatch):
    setup_provider(monkeypatch,{'summary':'없음','decisions':[]})
    with pytest.raises(HTTPException): insights.impact(impact_request())


def test_provider_failure_not_success(monkeypatch):
    p=setup_provider(monkeypatch,{})
    p.enabled=False
    with pytest.raises(HTTPException): insights.impact(impact_request())


def test_coverage_flags_uncovered_text_and_missing_artifacts(monkeypatch):
    setup_provider(monkeypatch,dict(atoms=[dict(quote='SOC 30% 이상',kind='조건',issueIds=[1],artifacts=[],reason='조건')],concerns=[],approved=True))
    result=insights.coverage(insights.CoverageRequest(requirementContent='SOC 30% 이상. 통신 오류 시 재시도.',issues=[{'id':1,'artifacts':[]}]))
    assert not result['approved']
    assert any('통신 오류' in c for c in result['concerns'])


def test_coverage_rejects_fabricated_artifact_evidence(monkeypatch):
    setup_provider(monkeypatch,dict(atoms=[dict(quote='작업 배정',issueIds=[1],artifacts=[dict(issueId=1,type='functional',field='overview',quote='작업 배정')])],concerns=[],approved=True))
    with pytest.raises(HTTPException): insights.coverage(insights.CoverageRequest(requirementContent='작업 배정',issues=[{'id':1,'artifacts':[{'type':'functional','content':{'overview':'다른 내용'}}]}]))

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
