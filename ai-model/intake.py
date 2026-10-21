"""Registration intake: project terminology and answerable clarification questions."""
import json
import logging
import unicodedata
import re
import rules
import review

TERM = re.compile(r'(?<![A-Za-z0-9_])(?:SoC|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+|(?:[A-Z][a-z]+){2,}|[A-Z][A-Z0-9_]{1,})(?![A-Za-z0-9_])')


class AnswerGenerationError(ValueError):
    """The model returned an unusable answer; this is not invalid user input."""


def glossary_text(rows):
    active=[r for r in rows if r.get('status')!='DISMISSED']
    ignored=[r['name'] for r in rows if r.get('status')=='DISMISSED']
    return '\n프로젝트 용어사전(사용자 확정 정의가 우선, PENDING은 AI 추정으로 사실처럼 단정 금지):\n' + json.dumps(active, ensure_ascii=False) + '\n사용하지 않기로 결정한 용어 이름(재등록하거나 뜻을 추정하지 않음):' + json.dumps(ignored,ensure_ascii=False)


# These are generic UI/implementation words, not project-domain concepts.
GENERIC_TERMS = set("시스템 사용자 운영자 화면 상태 조건 기준 등록 수정 삭제 조회 저장 버튼 목록 내용 요구사항 담당자 예외처리 system user operator screen status state condition requirement data api http https json xml html css ui ux db database id url tcp udp sql dto request response true false and or null none ms".split())
STATE_VALUES = {'ASSIGNED','IDLE','RUNNING','COMPLETED','FAILED','READY','PENDING','SUCCESS','ERROR','ACTIVE','INACTIVE','WAITING'}
TERM_KINDS = {'DOMAIN_SYSTEM','DOMAIN_ENTITY','BUSINESS_CONCEPT','WORKFLOW_CONCEPT','DOMAIN_METRIC'}
MAX_NEW_TERMS = 5
ALIASES = {
    'vehiclecontrolsystem':'vcs', 'autonomousmobilerobot':'amr',
    'automatedguidedvehicle':'agv', 'stateofcharge':'soc',
}
VCS_CORE = {'vcs','amr','agv','soc','taskstep','trafficzone','작업스텝','가용amr'}


def term_key(name):
    name=unicodedata.normalize('NFKC',name).strip()
    pair=re.fullmatch(r'([^()]+)\(([^()]+)\)',name)
    if pair and term_key(pair[1])==term_key(pair[2]): return term_key(pair[1])
    key=re.sub(r'[\W_]+','',name,flags=re.UNICODE).casefold()
    return ALIASES.get(key,key)


def eligible_term(name):
    key=term_key(name)
    if not key or key in GENERIC_TERMS: return False
    # State lists belong inside the parent concept's definition, not separate rows.
    if name.upper() in STATE_VALUES or re.fullmatch(r'[A-Z0-9]+(?:_[A-Z0-9]+)+',name): return False
    if re.fullmatch(r'(?:REQ|TASK|ISSUE|STEP)[-_]?\d+',name,re.I): return False
    if re.search(r'(?:DTO|Request|Response|Controller|Repository|Service)$',name) and key not in VCS_CORE: return False
    return True


def extract_terms(content, glossary, provider, parse_json, context, project_context=None):
    project_context=project_context or {}
    known={term_key(r['name']) for r in glossary}
    scope=' '.join(str(project_context.get(k) or '') for k in ('name','description')).strip()
    scope_key=term_key(scope)
    # No broad "all acronyms/title-case words" fallback. Uncertain terms are omitted.
    vcs_scope=any(x in (scope or content).casefold() for x in ('vcs','vehicle control system','차량 제어','amr','agv'))
    fallback=[]
    for m in TERM.finditer(content):
        name=m.group().strip();key=term_key(name)
        if key in known or not eligible_term(name): continue
        if not ((vcs_scope and key in VCS_CORE) or (scope_key and key in scope_key)): continue
        known.add(key)
        line_start=content.rfind('\n',0,m.start())+1
        line_end=content.find('\n',m.end())
        quote=content[max(line_start,m.start()-400):min(line_end if line_end>=0 else len(content),m.end()+400)]
        fallback.append(dict(name=name,definition=f'「{quote}」에서 사용하는 프로젝트 도메인 용어로 보입니다. 정확한 의미와 범위는 사용자 확인이 필요합니다.',quote=quote))
        if len(fallback)>=MAX_NEW_TERMS: break
    if not provider.enabled: return fallback, 'RULE_ONLY'
    try:
        raw=provider.generate('''요구사항 등록 시 현재 프로젝트의 핵심 도메인 용어만 선별한다. 단어 수집이나 일반 개발 용어 사전이 아니다.
프로젝트 이름·설명, 기존 요구사항, 사용자 확정 용어로 업무 도메인을 먼저 판단한다. VCS는 예시일 뿐이며 다른 프로젝트에 VCS 용어를 억지로 추가하지 않는다.
이 용어의 프로젝트 고유 의미를 모르면 요구사항을 잘못 해석할 가능성이 큰 경우만 HIGH로 선정한다. 중요한 용어가 없으면 terms=[]를 반환한다. 보통 0~3개, 최대 5개. 개수를 채우려고 추출하지 않는다.
예: VCS 차량 제어 프로젝트의 VCS(Vehicle Control System), AMR, SOC, Task Step 같은 핵심 업무 개념은 후보가 될 수 있다.
제외: 시스템/사용자/화면/상태/조건 같은 일반 단어, API/HTTP/JSON/ID 같은 일반 IT 약어, 문서 제목, 수치/단위/요구사항 ID, 구현 클래스/변수/필드 이름.
ASSIGNED, MOVE_TO_LOAD 같은 개별 상태는 독립 등록하지 말고 Task Step 같은 상위 개념의 내용에 목록으로 설명한다. 일반 동작이나 문장 전체를 용어로 만들지 않는다.
동의어·약어와 풀네임은 한 개념으로 본다. 기존 용어가 있으면 새 행으로 등록하지 않는다. 기존 정의는 덮어쓰지 않는다.
정의는 문맥 근거로 추정하고 불확실성을 명시한다. 없는 정책·수치·단계 목록은 만들지 않는다. name은 현재 본문에 실제 등장하는 표기, quote는 정확한 본문 인용이다.
JSON만 반환: {"terms":[{"name":"Task Step","definition":"문맥에 근거한 의미와 적용 범위","quote":"실제 사용 문장","importance":"HIGH","kind":"WORKFLOW_CONCEPT","domainReason":"이 프로젝트에서 태스크 전환 규칙을 이해하는 핵심 개념인 이유"}]}
kind는 DOMAIN_SYSTEM, DOMAIN_ENTITY, BUSINESS_CONCEPT, WORKFLOW_CONCEPT, DOMAIN_METRIC 중 하나다.''',
            '현재 프로젝트 정보:\n'+json.dumps(project_context,ensure_ascii=False)+'\n'+context+glossary_text(glossary))
        data=parse_json(raw)
        if not isinstance(data.get('terms'),list): raise ValueError('용어 목록 누락')
        terms=[];seen={term_key(r['name']) for r in glossary}
        for row in data['terms']:
            if not isinstance(row,dict): continue
            name=str(row.get('name','')).strip();definition=str(row.get('definition','')).strip();quote=str(row.get('quote',''))
            if not name or len(name)>100 or not definition or len(definition)>10000 or not quote or quote not in content: continue
            if row.get('importance')!='HIGH' or row.get('kind') not in TERM_KINDS or len(str(row.get('domainReason','')).strip())<10: continue
            if not eligible_term(name) or name.casefold() not in quote.casefold() or term_key(name) in seen: continue
            seen.add(term_key(name));terms.append(dict(name=name,definition=definition,quote=quote))
            if len(terms)>=MAX_NEW_TERMS: break
        return terms,'COMPLETE'
    except Exception as error:
        from providers.base import ProviderError
        if isinstance(error,ProviderError):
            logging.getLogger('ai-model').warning('AI glossary failed stage=%s code=%s upstreamStatus=%s',error.stage,error.code,error.upstream_status)
        return fallback,'FAILED'


def attach_questions(findings, glossary):
    states=[]
    for term in glossary:
        if term.get('status')=='CONFIRMED':
            states.extend(re.findall(r'\b(?:[A-Z]+_[A-Z_]+|ASSIGNED|IDLE|RUNNING|COMPLETED|FAILED)\b',term.get('definition','')))
    for f in findings:
        if f.question_text: continue
        text=f.target_span
        if f.finding_type==rules.T_WHEN:
            if '우선순위' in f.reason or 'AND' in f.reason:
                f.question_text='어떤 조건 조합에서 이 동작을 수행해야 하나요?'
                f.options=[p['after'] for p in f.proposals]
            else:
                f.question_text='이 동작은 어떤 상황이나 조건에서 발생하나요?'
                f.options=[s+' 상태가 되었을 때' for s in dict.fromkeys(states)]
        elif f.finding_type==rules.T_SUBJECT:
            f.question_text='이 동작은 누가 수행하나요?'
            f.options=['시스템이 자동으로 처리','운영자가 직접 처리']
        elif f.finding_type==rules.T_BOUNDARY:
            f.question_text='설명된 예외 상황이 발생하면 어떻게 처리해야 하나요?'
            f.options=['실패로 종료','대기 후 재시도','운영자에게 알림']
        elif f.finding_type==rules.T_CONFLICT:
            f.question_text='기존 요구사항과 다른 이 기준은 어떤 방향으로 적용해야 하나요?'
            f.options=['기존 요구사항의 기준을 적용','현재 기준을 유지하고 기존 요구사항도 수정 예정','적용 조건을 나누어 사용']
        elif '출발점' in f.reason or '도착점' in f.reason:
            f.question_text='거리는 어느 위치에서 어느 위치까지 계산하나요?'
        elif '거리' in f.reason:
            f.question_text='가까운 순서는 어떤 거리 계산 방식으로 판단하나요?'
        elif '응답' in text and '재시도' in text:
            f.question_text='응답을 최대 얼마 동안 기다린 뒤 재시도하나요?'
        elif '주기적으로' in text:
            f.question_text='얼마 간격으로 반복해야 하나요?'
        elif any(x in text for x in ['즉시','신속히','빠르게']):
            f.question_text='동작을 완료해야 하는 최대 시간은 얼마인가요?'
        elif '가용' in text:
            f.question_text='어떤 상태와 조건을 만족해야 가용한 AMR로 판단하나요?'
        elif 'SoC' in text or 'SOC' in text:
            f.question_text='적용할 SOC 기준값과 비교 조건은 무엇인가요?'
        else:
            f.question_text='이 동작의 판단 기준을 어떻게 정하면 될까요?'
    return findings


def answer_replacement(content, before, question, answer, proposals, glossary, provider, parse_json):
    glossary=[t for t in glossary if t.get('status')!='DISMISSED']
    answer=answer.strip()
    if not answer: raise ValueError('답변을 입력해주세요.')
    for proposal in proposals:
        if answer==proposal.get('after') and proposal.get('operation')=='REPLACE': return answer
    if provider.enabled:
        raw=provider.generate('''사용자 답변을 반영해 요구사항의 선택된 문장만 자연스러운 한국어로 구체화한다.
사용자 답변과 확정된 용어 정의를 우선한다. 질문 대상 이외의 기존 조건·주체·수치를 삭제하거나 변경하지 않는다.
답변하지 않은 정책을 새로 정하거나 빈 값 표시를 추가하지 않는다. PENDING 용어 정의는 확정 사실이 아니다.
JSON만 반환: {"replacement":"원문 대신 들어갈 완전한 문장"}''',json.dumps(dict(content=content,targetSpan=before,question=question,answer=answer,glossary=glossary),ensure_ascii=False))
        try:
            result=parse_json(raw).get('replacement')
        except Exception as error:
            raise AnswerGenerationError('AI가 문장 반영 결과를 올바른 형식으로 반환하지 못했습니다. 다시 시도해주세요.') from error
        if not isinstance(result,str) or not result.strip() or len(result)>12000: raise AnswerGenerationError('AI가 문장 반영 결과를 올바른 형식으로 반환하지 못했습니다. 다시 시도해주세요.')
        numbers=set(re.findall(r'\d+(?:\.\d+)?',before+' '+answer+' '+json.dumps([t for t in glossary if t.get('status')=='CONFIRMED'],ensure_ascii=False)))
        if any(n not in numbers for n in re.findall(r'\d+(?:\.\d+)?',result)): raise AnswerGenerationError('AI가 답변에 근거 없는 수치를 추가해 반영하지 않았습니다. 입력은 유지됩니다. 다시 시도해주세요.')
        if '⟦' in result or '⟧' in result: raise AnswerGenerationError('AI가 답변하지 않은 빈 값을 추가해 반영하지 않았습니다. 입력은 유지됩니다. 다시 시도해주세요.')
        if result.strip()==before: raise AnswerGenerationError('AI가 답변을 반영한 문장을 만들지 못했습니다. 입력은 유지됩니다. 다시 시도해주세요.')
        return result.strip()
    if '필요 시' in before:
        condition=answer.rstrip('.')
        if not condition.endswith(('때','경우','시')):condition+='일 때'
        return before.replace('필요 시',condition,1)
    if '주기적으로' in before and re.search(r'\d',answer):
        return before.replace('주기적으로',answer if answer.endswith('마다') else answer+'마다',1)
    if '응답이 없으면' in before and re.fullmatch(r'\d+(?:\.\d+)?\s*(?:ms|초|분)',answer):
        return before.replace('응답이 없으면',f'요청 전송 후 {answer} 이내에 응답이 없으면',1)
    for proposal in proposals:
        if proposal.get('operation')=='REPLACE' and len(review.MARKER.findall(proposal['after']))==1:
            return review.MARKER.sub(lambda _:answer,proposal['after'])
    raise ValueError('AI 문장 작성에 연결하지 못했습니다. 답변은 입력란에 유지됩니다. 다시 시도하거나 본문을 직접 수정해주세요.')
