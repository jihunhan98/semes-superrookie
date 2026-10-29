"""Contextual findings and precise, opt-in edits. Offsets on the wire are UTF-16."""
from __future__ import annotations
import re
from dataclasses import dataclass, field
import rules

MARKER = re.compile(r"⟦[^⟧]+⟧")


def utf16(text: str) -> int:
    return len(text.encode('utf-16-le')) // 2


def sentences(content: str):
    for match in re.finditer(r"[^\n]+", content):
        for piece in re.finditer(r".+?(?:[.!?](?!\d)|$)", match.group()):
            text = piece.group().strip()
            if text:
                yield text, match.start() + piece.start() + len(piece.group()) - len(piece.group().lstrip())


def heading(text: str) -> bool:
    if re.search(r'(?:SOC|SoC|주기|시간|제한|최소|최대).*?\d+\s*(?:%|ms|초|분|회)', text):
        return False
    return not re.search(r"한다|된다|해야|하면|이면|시킨다|합니다|처리하|전환하|기록하|선택하|재시도|수행하|설정하|포함하|보고하|기다린다|허용", text)


def scope_note(text: str) -> bool:
    """Scope and administrative agreements are not executable behaviour."""
    return bool(re.search(r'(?:범위.{0,20}(?:제외|포함하지|해당하지)|별도(?:로)?\s*협의|본 문서.{0,20}(?:다루지|제외)|out of scope)', text, re.I))


@dataclass
class Finding:
    finding_type: str
    target_span: str
    reason: str
    suggestion: str
    conflict_req_key: str | None = None
    severity: str = 'ADVISORY'
    proposals: list[dict] = field(default_factory=list)
    interpretations: str = ''
    conflict_quote: str | None = None
    span_start: int = 0
    span_end: int = 0
    question_text: str = ''
    options: list[str] = field(default_factory=list)

    def to_dict(self):
        return dict(findingType=self.finding_type, targetSpan=self.target_span,
                    reason=self.reason, suggestion=self.suggestion, conflictReqKey=self.conflict_req_key,
                    severity=self.severity, proposals=self.proposals, interpretations=self.interpretations,
                    conflictQuote=self.conflict_quote, spanStart=self.span_start, spanEnd=self.span_end, questionText=self.question_text, options=self.options)


def make(content, text, offset, kind, reason, suggestion, after=None, **kwargs):
    proposals = []
    if after is not None:
        proposals = [dict(label='템플릿 적용' if MARKER.search(after) else '제안 적용', operation='REPLACE',
                          before=text, after=after, start=utf16(content[:offset]),
                          end=utf16(content[:offset + len(text)]), needsInput=bool(MARKER.search(after)))]
    return Finding(kind, text, reason, suggestion, proposals=proposals,
                   span_start=utf16(content[:offset]), span_end=utf16(content[:offset + len(text)]), **kwargs)


def detect(content: str, existing: list[dict] | None = None, definitions: str = ""):
    existing = existing or []
    result = []
    known = {r['reqKey'].casefold(): r for r in existing}
    for text, offset in sentences(content):
        if heading(text) or scope_note(text):
            continue
        refs = rules._REQ_REFERENCE.findall(text)
        reference_text = '\n'.join(known[r.casefold()]['content'] for r in refs if r.casefold() in known)
        other_context = content[:offset] + content[offset + len(text):] + '\n' + reference_text + '\n' + definitions
        context_text = '\n'.join([content, reference_text, definitions])
        logic = re.search(r'([A-Za-z가-힣0-9_]+)\s*또는\s*([A-Za-z가-힣0-9_]+)\s*및\s*([A-Za-z0-9_]+|[가-힣]+?)(?=이면|일 때|인 경우|\s|[,.])', text)
        if logic and not re.search(r'모두|중 하나|괄호|\(', text):
            a, b, c = logic.groups()
            f = make(content, text, offset, rules.T_CONJ,
                     'OR와 AND의 우선순위가 명시되지 않아 전환 결과가 달라집니다.',
                     '조건식을 선택하세요. AI가 우선순위를 임의로 정하지 않습니다.',
                     interpretations=f'{a}=참, {b}=거짓, {c}=거짓일 때 (A OR B) AND C는 거짓, A OR (B AND C)는 참입니다.')
            for label, replacement in [(f'({a} 또는 {b}) 그리고 {c}', f'({a} 또는 {b}) 그리고 {c}'),
                                       (f'{a} 또는 ({b} 그리고 {c})', f'{a} 또는 ({b} 그리고 {c})')]:
                f.proposals.append(dict(label=label, operation='REPLACE', before=text,
                    after=text[:logic.start()]+replacement+text[logic.end():], start=f.span_start,
                    end=f.span_end, needsInput=False))
            result.append(f)
        if '응답' in text and '재시도' in text and not re.search(r'\d+\s*(ms|초|분)|대기시간|타임아웃|주기', text + other_context):
            result.append(make(content, text, offset, rules.T_TIME,
                '응답을 언제까지 기다린 뒤 재시도하는지 기준이 없어 같은 지연에 대해 동작이 달라집니다.',
                '고객이 정한 대기시간과 재시도 정책을 입력하세요. 기존 공통 정책이 있으면 참조하세요.',
                '요청 전송 후 ⟦응답 대기시간(ms): 입력 필요⟧ 이내에 응답이 없으면 '
                '⟦재시도 간격(ms): 입력 필요⟧마다 최대 ⟦재시도 횟수: 입력 필요⟧회 재시도한다. '
                '이후 ⟦실패 처리 정책: 입력 필요⟧에 따른다.'))
        for phrase, kind, reason, question, _ in rules.PHRASE_RULES:
            if phrase in ('및', '등을', '담당자가', '관련 부서') or phrase not in text:
                continue
            # A definition or explicit reference supplies context; do not flag its reuse.
            if refs and reference_text:
                continue
            if re.search(re.escape(phrase) + r'.{0,80}(정의|기준|란|의미|=)', other_context):
                continue
            if phrase in ('가용한 AMR', '가용 AMR') and re.search(r'가용[^.\n]{0,80}(?:IDLE|정의|상태|SOC|SoC)', context_text):
                continue
            if phrase == 'SoC 최소값' and re.search(r'(?:SoC|SOC|배터리).{0,25}\d+\s*%\s*(?:이상|초과)|(?:SoC|SOC|배터리).{0,20}최소.{0,12}\d+\s*%', context_text):
                continue
            if phrase == '가장 가까운' and re.search(r'경로거리|직선거리|맨해튼|거리 기준', context_text):
                continue
            if phrase in ('즉시', '신속히', '주기적으로', '가능한 한 빠르게') and re.search(r'\d+\s*(ms|초|분)', context_text):
                continue
            replacements = {'SoC 최소값': '⟦최소 SOC(%): 입력 필요⟧',
                            '주기적으로': '⟦주기(ms): 입력 필요⟧마다',
                            '즉시': '⟦허용 지연시간(ms): 입력 필요⟧ 이내에',
                            '신속히': '⟦처리시간(ms): 입력 필요⟧ 이내에',
                            '가장 가까운': '⟦거리 계산 기준: 입력 필요⟧으로 가장 가까운',
                            '필요 시': '⟦발생 조건: 입력 필요⟧일 때',
                            '이상 발생 시': '⟦이상 판정 조건: 입력 필요⟧일 때',
                            '가용한 AMR': '⟦가용 판정 조건: 입력 필요⟧을 만족하는 AMR',
                            '가용 AMR': '⟦가용 판정 조건: 입력 필요⟧을 만족하는 AMR'}
            after = text.replace(phrase, replacements.get(phrase, f'⟦{phrase}의 구체적 기준: 입력 필요⟧'), 1)
            result.append(make(content, text, offset, kind, reason, question, after))
        if 'AMR' in text and ('매칭' in content):
            if '맨해튼 거리' in text and not any(x in content for x in ('작업 시작 위치', '요청 위치', '목적지', '도착 위치')):
                result.append(make(content, text, offset, rules.T_QUANT, '거리 계산의 출발점과 도착점이 없어 같은 거리값을 재현할 수 없습니다.',
                    '거리 계산의 양 끝점을 입력하세요.', text.replace('맨해튼 거리', '⟦출발 위치: 입력 필요⟧와 ⟦도착 위치: 입력 필요⟧ 사이의 맨해튼 거리')))
            if '선택한다' in text and not re.search(r'후보가 없|AMR이 없|대기|재시도|매칭 실패', context_text):
                result.append(make(content, text, offset, rules.T_BOUNDARY, '조건을 만족하는 AMR이 한 대도 없을 때 매칭 요청의 결과가 정의되지 않았습니다.',
                    '후보가 없을 때의 동작을 정하세요.', text + ' 후보가 없으면 ⟦매칭 실패/대기 정책: 입력 필요⟧에 따른다.'))
        if 'SoC 높은 순' in text and not re.search(r'동률|같으면|동일하면|같은 경우', context_text):
            result.append(make(content, text, offset, rules.T_BOUNDARY, '거리와 SoC가 모두 같을 때 최종 선택 기준이 없습니다.',
                '동률 처리 기준을 입력하세요.', text + ' 동률이면 ⟦최종 선택 기준: 입력 필요⟧으로 정한다.'))
    result.extend(soc_conflicts(content, existing))
    return dedupe(result)


def soc_policies(content):
    for text, offset in sentences(content):
        if heading(text) or scope_note(text):
            continue
        m = re.search(r'(?:SOC|SoC|배터리(?: 잔량)?).{0,12}?(\d+(?:\.\d+)?)\s*%\s*(이상|초과|이하|미만)', text)
        scope = '매칭' if re.search(r'매칭|후보', text) else ('충전' if '충전' in text else None)
        if m and scope:
            yield text, offset, m, scope


def soc_conflicts(content, existing):
    out = []
    for text, offset, mine, scope in soc_policies(content):
        for row in existing:
            for quote, _, other, other_scope in soc_policies(row['content']):
                # Exceptions require contextual review instead of keyword-only contradiction claims.
                if scope != other_scope or re.search(r'예외|단,|경우에|때에는', text + quote):
                    continue
                if mine.group(1, 2) == other.group(1, 2):
                    continue
                f = make(content, text, offset, rules.T_CONFLICT,
                    f'{row["reqKey"]}와 같은 {scope} SOC 기준이 다릅니다: {other.group(1)}% {other.group(2)} ↔ {mine.group(1)}% {mine.group(2)}.',
                    '기존 기준을 적용하거나 새 합의에 따라 원문을 유지하고 기존 요구사항을 별도로 수정하세요.',
                    text[:mine.start(1)] + other.group(1) + '% ' + other.group(2) + text[mine.end(2):],
                    conflict_req_key=row['reqKey'], conflict_quote=quote,
                    severity='ADVISORY')
                # A deterministic rule cannot infer equivalent application conditions from keywords.
                # Only an otherwise identical policy can be a mandatory contradiction here.
                lhs = re.sub(r'\s+', '', text[:mine.start(1)] + '#' + text[mine.end(2):]).casefold()
                rhs = re.sub(r'\s+', '', quote[:other.start(1)] + '#' + quote[other.end(2):]).casefold()
                if lhs == rhs and (row.get('state') == 'CONFIRMED' or bool(row.get('version'))):
                    f.severity = 'BLOCKING'
                f.proposals[0]['label'] = f'{row["reqKey"]} 기준 적용'
                out.append(f)
    return out


def dedupe(findings):
    out, seen = [], set()
    for f in findings:
        key = (f.finding_type, f.span_start, f.conflict_req_key, f.reason)
        if key not in seen:
            seen.add(key)
            out.append(f)
        elif f.interpretations and f.proposals:
            index = next(i for i, old in enumerate(out) if (old.finding_type, old.span_start, old.conflict_req_key, old.reason) == key)
            out[index] = f
    return out


def model_findings(raw: dict, content: str, existing: list[dict]):
    """Reject ungrounded locations and unconstrained prose pretending to be an edit."""
    out = []
    sources = {r['reqKey']: r for r in existing}
    for row in raw.get('findings', []):
        if not isinstance(row, dict):
            continue
        row = dict(row, findingType=rules.normalize_type(row.get('findingType')))
        if row['findingType'] is None:
            continue
        span = row.get('targetSpan', '')
        if not span or len(span) > 500 or content.count(span) != 1 or heading(span) or scope_note(span):
            continue
        if row.get('findingType') not in rules.ALL_TYPES or not row.get('interpretations'):
            continue
        conflict_key = row.get('conflictReqKey')
        other = sources.get(conflict_key)
        quote = row.get('conflictQuote')
        if conflict_key and (not other or not quote or quote not in other['content']):
            continue
        if row['findingType'] == rules.T_CONFLICT and (not other or not row.get('sameCondition')):
            continue
        start = content.index(span)
        f = make(content, span, start, row['findingType'], str(row.get('reason', ''))[:1000],
                 str(row.get('suggestion', ''))[:1000], interpretations=str(row['interpretations']),
                 conflict_req_key=conflict_key, conflict_quote=quote,
                 severity='BLOCKING' if other and (other.get('state') == 'CONFIRMED' or bool(other.get('version'))) and row['findingType'] == rules.T_CONFLICT else 'ADVISORY')
        f.question_text = str(row.get('questionText') or '')[:1000]
        f.options = [str(x)[:1000] for x in row.get('options', []) if isinstance(x, str)][:8]
        evidence = content + '\n' + (quote or '')
        for p in row.get('proposals', [])[:4]:
            operation = p.get('operation', 'REPLACE')
            after = str(p.get('after', ''))
            if operation not in ('REPLACE', 'INSERT_BEFORE', 'INSERT_AFTER', 'DELETE'):
                continue
            if operation != 'DELETE' and not after.strip():
                continue
            # New numerical candidates remain proposals and are explicitly labeled for user approval.
            new_numbers = re.findall(r'\d+(?:\.\d+)?', MARKER.sub('', after))
            numeric_candidate = any(n not in re.findall(r'\d+(?:\.\d+)?', evidence) for n in new_numbers)
            if numeric_candidate:
                # Candidates are allowed only as explicit user-reviewed proposals, never source facts.
                p = dict(p, label='AI 제안값 · 사용자 확인: ' + str(p.get('label', '수정안')))
                notice = 'AI 제안값은 원문에서 확인된 수치가 아니므로 적용 전에 사용자가 검토해야 합니다.'
                if notice not in f.interpretations:
                    f.interpretations += '\n' + notice
            if len(after) > 6000:
                continue
            f.proposals.append(dict(label=str(p.get('label', '제안 적용'))[:100],
                operation=operation, before=span, after='' if operation == 'DELETE' else after,
                start=f.span_start, end=f.span_end, needsInput=bool(MARKER.search(after))))
        out.append(f)
    return out
