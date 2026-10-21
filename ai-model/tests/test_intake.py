import json
from fastapi.testclient import TestClient
import main, intake, review
client=TestClient(main.app)

def test_registration_returns_questions_and_grounded_unconfirmed_terms():
    text='Task Step은 VCS의 태스크 수행 단계이다. 필요 시 작업을 재할당한다.'
    body=client.post('/analyze',json={'content':text}).json()
    assert any(t['name']=='Task Step' for t in body['terms'])
    assert all(t['quote'] in text and t['name'].casefold() in t['quote'].casefold() for t in body['terms'])
    question=next(f for f in body['findings'] if f['findingType']=='동작 조건 불명확')
    assert '어떤 상황' in question['questionText']
    assert body['draftContent']==text

def test_confirmed_glossary_is_sent_to_ai_and_never_returned_as_duplicate(monkeypatch):
    calls=[]
    class Provider:
        enabled=True
        name='test'
        def generate(self,system,user):
            calls.append(user)
            if '"terms"' in system:
                return json.dumps({'terms':[{'name':'Task Step','definition':'AI가 다르게 추정한 의미','quote':'Task Step 상태를 확인한다.'}]})
            return '{"findings":[]}'
    monkeypatch.setattr(main,'PROVIDER',Provider())
    body=client.post('/analyze',json={'content':'Task Step 상태를 확인한다.','glossary':[{'id':1,'name':'Task Step','definition':'태스크 수행 단계. ASSIGNED, MOVE_TO_LOAD가 있다.','status':'CONFIRMED'}]}).json()
    assert not body['terms']
    assert all('MOVE_TO_LOAD' in call and 'CONFIRMED' in call for call in calls)

def test_pending_guess_is_not_used_as_confirmed_policy():
    text='AMR 매칭 시 가용 AMR을 선택한다.'
    glossary=[{'name':'가용 AMR','definition':'가용 AMR은 IDLE 상태를 의미한다.','status':'PENDING'}]
    body=client.post('/analyze',json={'content':text,'glossary':glossary}).json()
    assert any('가용' in f['reason'] for f in body['findings'])
    glossary[0]['status']='CONFIRMED'
    body=client.post('/analyze',json={'content':text,'glossary':glossary}).json()
    assert not any('가용' in f['reason'] for f in body['findings'])

def test_glossary_states_do_not_implicitly_define_available_amr():
    definitions='Task Step에는 IDLE, ASSIGNED, MOVE_TO_LOAD 상태가 있다.'
    findings=review.detect('가용 AMR을 선택한다.',[],definitions)
    assert any('가용' in f.reason for f in findings)

def test_soc_range_definition_does_not_invent_a_minimum_threshold():
    findings=review.detect('SoC 최소값 이상인 AMR을 선택한다.',[],'SOC는 배터리 잔량이며 0%~100% 범위로 표시한다.')
    assert any('최소값' in f.reason for f in findings)

def test_condition_answer_is_applied_to_sentence_without_fabricating_policy():
    body=client.post('/clarify-answer',json={'content':'필요 시 작업을 재할당한다.','targetSpan':'필요 시 작업을 재할당한다.','question':'어떤 상황에서 발생하나요?','answer':'AMR 통신 장애가 발생했을 때'}).json()
    assert body['replacement']=='AMR 통신 장애가 발생했을 때 작업을 재할당한다.'

def test_timing_answer_does_not_add_retry_count():
    body=client.post('/clarify-answer',json={'content':'응답이 없으면 재시도한다.','targetSpan':'응답이 없으면 재시도한다.','question':'얼마나 기다리나요?','answer':'1000ms'}).json()
    assert body['replacement']=='요청 전송 후 1000ms 이내에 응답이 없으면 재시도한다.'
    assert '3회' not in body['replacement']

def test_answer_unknown_target_is_rejected():
    response=client.post('/clarify-answer',json={'content':'새 문장','targetSpan':'이전 문장','question':'어떤 조건인가요?','answer':'답변'})
    assert response.status_code==409

def test_model_cannot_invent_unanswered_numeric_policy(monkeypatch):
    class Provider:
        enabled=True
        name='test'
        def generate(self,*args):return '{"replacement":"1초 후 3회 재시도한다."}'
    monkeypatch.setattr(main,'PROVIDER',Provider())
    response=client.post('/clarify-answer',json={'content':'응답이 없으면 재시도한다.','targetSpan':'응답이 없으면 재시도한다.','question':'대기시간?','answer':'1000ms'})
    assert response.status_code==502
    assert response.json()['detail']['code']=='ANSWER_GENERATION'
    assert '근거 없는 수치' in response.json()['detail']['message']

def test_new_task_step_states_are_not_options_until_user_confirms_definition():
    text='필요 시 다음 스텝으로 전환한다.'
    pending=[{'name':'Task Step','definition':'ASSIGNED, MOVE_TO_LOAD','status':'PENDING'}]
    f=intake.attach_questions(review.detect(text),pending)[0]
    assert not f.options
    f=intake.attach_questions(review.detect(text),[{**pending[0],'status':'CONFIRMED'}])[0]
    assert 'MOVE_TO_LOAD 상태가 되었을 때' in f.options

def test_dismissed_terms_are_not_recreated_or_used_as_definitions():
    glossary=[{'name':'Task Step','definition':'사용하지 않을 추정 의미','status':'DISMISSED'}]
    body=client.post('/analyze',json={'content':'Task Step 상태를 표시한다.','glossary':glossary}).json()
    assert not body['terms']
    assert '사용하지 않을 추정 의미' not in intake.glossary_text(glossary)
    assert 'Task Step' in intake.glossary_text(glossary)


def test_provider_timeout_is_not_reported_as_invalid_input(monkeypatch):
    from providers.base import ProviderError
    class Provider:
        enabled=True
        name='test'
        def generate(self,*args):raise ProviderError('TIMEOUT',True,'internal timeout')
    monkeypatch.setattr(main,'PROVIDER',Provider())
    response=client.post('/clarify-answer',json={'content':'필요 시 작업을 시작한다.','targetSpan':'필요 시 작업을 시작한다.','question':'어떤 조건인가요?','answer':'통신 장애가 발생했을 때'})
    assert response.status_code==504
    assert response.json()['detail']['code']=='PROVIDER_TIMEOUT'


def test_invalid_model_json_is_not_reported_as_invalid_input(monkeypatch):
    class Provider:
        enabled=True
        name='test'
        def generate(self,*args):return '완성하지 못한 응답'
    monkeypatch.setattr(main,'PROVIDER',Provider())
    response=client.post('/clarify-answer',json={'content':'필요 시 작업을 시작한다.','targetSpan':'필요 시 작업을 시작한다.','question':'어떤 조건인가요?','answer':'통신 장애가 발생했을 때'})
    assert response.status_code==502
    assert response.json()['detail']['code']=='ANSWER_GENERATION'


def test_schema_error_identifies_missing_field_without_echoing_user_content():
    response=client.post('/clarify-answer',json={'content':'PRIVATE_REQUIREMENT_TEXT','answer':'답변'})
    assert response.status_code==422
    assert response.json()['code']=='REQUEST_VALIDATION'
    assert any('targetSpan' in e['loc'] for e in response.json()['detail'])
    assert 'PRIVATE_REQUIREMENT_TEXT' not in response.text


def test_rule_only_unsupported_answer_has_actionable_reason():
    response=client.post('/clarify-answer',json={'content':'거리를 계산한다.','targetSpan':'거리를 계산한다.','question':'거리 기준인가요?','answer':'노드 간 최단경로'})
    assert response.status_code==422
    assert response.json()['detail']['code']=='ANSWER_NOT_APPLIED'
    assert '본문을 직접 수정' in response.json()['detail']['message']


def test_domain_fallback_excludes_general_words_status_values_and_implementation_names():
    content='VCS에서 AMR의 SOC와 Task Step을 관리한다. API HTTP JSON UI ID SYSTEM READY ASSIGNED MOVE_TO_LOAD TaskRequest UserController를 표시한다.'
    terms,status=intake.extract_terms(content,[],main.PROVIDER,main._parse_json,content,{'name':'VCS','description':'Vehicle Control System'})
    assert {t['name'] for t in terms}=={'VCS','AMR','SOC','Task Step'}
    assert status=='RULE_ONLY'


def test_domain_scope_does_not_import_vehicle_terms_into_unrelated_project():
    text='API에서 AMR 이벤트 예제를 전송한다.'
    terms,_=intake.extract_terms(text,[],main.PROVIDER,main._parse_json,text,{'name':'급여 관리','description':'직원 급여 정산'})
    assert not terms


def test_domain_model_must_justify_importance_and_receives_project_context():
    calls=[]
    text='웨이퍼 맵을 분석하고 화면에 READY 상태와 JSON을 표시한다.'
    def candidate(name,**extra):
        return dict(name=name,definition='설명',quote=text,importance='HIGH',kind='BUSINESS_CONCEPT',domainReason='프로젝트의 웨이퍼 검사 결과를 해석하는 핵심 업무 개념이다.',**extra)
    class Provider:
        enabled=True
        def generate(self,system,user):
            calls.append((system,user))
            return json.dumps({'terms':[candidate('화면'),candidate('READY'),candidate('JSON'),candidate('웨이퍼 맵'),{**candidate('분석'),'importance':'LOW'}]})
    terms,status=intake.extract_terms(text,[],Provider(),main._parse_json,text,{'name':'웨이퍼 검사','description':'웨이퍼 결함 검사 시스템'})
    assert status=='COMPLETE'
    assert [t['name'] for t in terms]==['웨이퍼 맵']
    assert '웨이퍼 결함 검사 시스템' in calls[0][1]
    assert 'terms=[]' in calls[0][0]


def test_domain_synonyms_do_not_create_multiple_glossary_rows():
    text='Vehicle Control System의 AMR을 제어한다.'
    terms,_=intake.extract_terms(text,[{'name':'VCS','definition':'차량 제어','status':'CONFIRMED'}],main.PROVIDER,main._parse_json,text,{'name':'VCS'})
    assert [t['name'] for t in terms]==['AMR']
    assert intake.term_key('VCS (Vehicle Control System)')==intake.term_key('VCS')


def test_domain_candidates_are_capped_and_not_forced_to_fill_quota():
    text=' '.join('핵심개념'+chr(65+i) for i in range(9))
    class Provider:
        enabled=True
        def generate(self,*args):
            return json.dumps({'terms':[dict(name='핵심개념'+chr(65+i),definition='프로젝트 고유 의미',quote=text,importance='HIGH',kind='DOMAIN_ENTITY',domainReason='프로젝트의 핵심 업무 개체로 사용되는 용어이다.') for i in range(9)]})
    terms,_=intake.extract_terms(text,[],Provider(),main._parse_json,text)
    assert len(terms)==5
