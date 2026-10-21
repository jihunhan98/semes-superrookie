"""Registration intake: project terminology and answerable clarification questions."""
import json
import re
import rules
import review

TERM = re.compile(r'(?<![A-Za-z0-9_])(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+|(?:[A-Z][a-z]+){2,}|[A-Z][A-Z0-9_]{1,})(?![A-Za-z0-9_])')


class AnswerGenerationError(ValueError):
    """The model returned an unusable answer; this is not invalid user input."""


def glossary_text(rows):
    active=[r for r in rows if r.get('status')!='DISMISSED']
    ignored=[r['name'] for r in rows if r.get('status')=='DISMISSED']
    return '\n프로젝트 용어사전(사용자 확정 정의가 우선, PENDING은 AI 추정으로 사실처럼 단정 금지):\n' + json.dumps(active, ensure_ascii=False) + '\n사용하지 않기로 결정한 용어 이름(재등록하거나 뜻을 추정하지 않음):' + json.dumps(ignored,ensure_ascii=False)


def extract_terms(content, glossary, provider, parse_json, context):
    known = {r['name'].casefold() for r in glossary}
    fallback = []
    for m in TERM.finditer(content):
        name=m.group().strip()
        if name.casefold() in known or name in {'AND','OR','REQ','TRUE','FALSE','MS'} or re.match(r'REQ[-_]',content[m.start():]): continue
        known.add(name.casefold())
        line_start=content.rfind('\n',0,m.start())+1
        line_end=content.find('\n',m.end())
        quote=content[max(line_start,m.start()-400):min(line_end if line_end>=0 else len(content),m.end()+400)]
        fallback.append(dict(name=name,definition=f'「{quote}」에서 사용하는 용어로 보입니다. 정확한 의미와 범위는 사용자 확인이 필요합니다.',quote=quote))
    if not provider.enabled: return fallback, 'RULE_ONLY'
    try:
        raw=provider.generate('''요구사항 등록 시 프로젝트 용어사전을 정리한다. 도메인 이해에 중요한 용어·상태·약어를 추출하고 문맥에서 의미를 추정한다.
기존 용어 이름은 중복 등록하지 않는다. 추정은 사용자가 확인하기 전까지 미확정이다. 없는 단계 목록·수치·업무 정책을 만들지 않는다.
용어 이름은 현재 본문에 실제로 나타난 표기를 사용하고 quote는 현재 본문의 정확한 인용이다.
JSON만 반환: {"terms":[{"name":"Task Step","definition":"문맥에 근거한 추정 의미. 불확실한 부분도 설명","quote":"실제 사용 문장"}]}''',context+glossary_text(glossary))
        data=parse_json(raw)
        if not isinstance(data.get('terms'),list): raise ValueError('용어 목록 누락')
        terms=[]; seen={r['name'].casefold() for r in glossary}
        for row in data['terms']:
            name=str(row.get('name','')).strip();definition=str(row.get('definition','')).strip();quote=str(row.get('quote',''))
            if not name or len(name)>100 or not definition or len(definition)>10000 or not quote or quote not in content: continue
            if name.casefold() not in quote.casefold() or name.casefold() in seen: continue
            seen.add(name.casefold());terms.append(dict(name=name,definition=definition,quote=quote))
        return terms,'COMPLETE'
    except Exception:
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
