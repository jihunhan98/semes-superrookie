import json
import monitoring

SOURCE='VCS는 IDLE 상태이고 SOC 30% 이상인 AMR을 배정 후보로 선정한다.'
TARGET={'reqKey':'REQ01','content':'VCS는 IDLE 상태이고 SOC 50% 이상인 AMR만 배정 후보로 선정한다.','state':'CONFIRMED','version':'1.0.0'}
def conflict():
 return {'reqKey':'REQ01','relation':'CONFLICT','sourceQuote':'SOC 30% 이상','targetQuote':'SOC 50% 이상','sameCondition':'IDLE 상태의 같은 AMR 배정 후보 판단','reason':'SOC 30% 이상 50% 미만인 후보의 포함/제외가 다릅니다.','reviewQuestion':'50%를 유지할지 30%로 변경할지 확인해주세요.'}
class Provider:
 enabled=True
 def __init__(self, response): self.response=response; self.requests=[]
 def generate(self, system, user): self.requests.append((system,json.loads(user))); return json.dumps(self.response)

def test_grounded_conflict_preserves_both_exact_quotes_and_question():
 rows,status=monitoring.compare(SOURCE,[TARGET],Provider({'comparisons':[conflict()]}),json.loads)
 assert status=='COMPLETE' and rows[0]['relation']=='CONFLICT'
 assert rows[0]['sourceQuote'] in SOURCE and rows[0]['targetQuote'] in TARGET['content']
 assert '30%' in rows[0]['reason'] and '확인' in rows[0]['reviewQuestion']

def test_none_requires_explicit_per_target_result():
 rows,status=monitoring.compare(SOURCE,[TARGET],Provider({'comparisons':[]}),json.loads)
 assert status=='FAILED' and rows[0]['relation']=='UNREVIEWED'
 rows,status=monitoring.compare(SOURCE,[TARGET],Provider({'comparisons':[{'reqKey':'REQ01','relation':'NONE','reason':'적용 동작이 다릅니다.'}]}),json.loads)
 assert status=='COMPLETE' and rows[0]['relation']=='NONE'

def test_invalid_quote_and_duplicate_id_are_unreviewed():
 wrong=conflict();wrong['targetQuote']='SOC 40% 이상'
 assert monitoring.validate([wrong],SOURCE,[TARGET])[0]['relation']=='UNREVIEWED'
 assert monitoring.validate([conflict(),conflict()],SOURCE,[TARGET])[0]['relation']=='UNREVIEWED'

def test_partial_results_keep_known_conflict_and_missing_target():
 second=dict(TARGET,reqKey='REQ03')
 rows,status=monitoring.compare(SOURCE,[TARGET,second],Provider({'comparisons':[conflict()]}),json.loads)
 assert status=='PARTIAL'
 assert [(x['reqKey'],x['relation']) for x in rows]==[('REQ01','CONFLICT'),('REQ03','UNREVIEWED')]

def test_disabled_provider_is_failed_never_none():
 p=Provider({});p.enabled=False
 rows,status=monitoring.compare(SOURCE,[TARGET],p,json.loads)
 assert status=='FAILED' and rows[0]['relation']=='UNREVIEWED' and not p.requests

def test_batching_keeps_entire_source_and_every_target():
 targets=[dict(TARGET,reqKey=f'REQ{i}',content='기존 본문. '*10000) for i in range(3)]
 p=Provider({'comparisons':[]})
 rows,status=monitoring.compare(SOURCE,targets,p,json.loads)
 assert len(p.requests)==3 and len(rows)==3 and status=='FAILED'
 assert all(payload['currentRequirement']==SOURCE for _,payload in p.requests)
 assert [x['reqKey'] for _,payload in p.requests for x in payload['existingRequirements']]==['REQ0','REQ1','REQ2']

def test_unknown_id_does_not_replace_requested_target():
 row=conflict();row['reqKey']='REQ-UNKNOWN'
 assert monitoring.validate([row],SOURCE,[TARGET])[0]['relation']=='UNREVIEWED'

def test_dependency_review_is_separate_from_direct_conflict():
 row=conflict();row['relation']='DEPENDENCY_REVIEW';row['reason']='기존 시험이 50% 성공만 검증하므로 30% 경계의 검증을 추가해야 합니다.'
 assert monitoring.validate([row],SOURCE,[TARGET])[0]['relation']=='DEPENDENCY_REVIEW'
