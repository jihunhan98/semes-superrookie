"""Requirement evidence and numeric validation for generated artifacts."""
from __future__ import annotations
import json
import os
import re

MAX_CONTEXT = int(os.getenv('AI_MAX_CONTEXT_CHARS', '120000'))

def checked_context(value):
    text = json.dumps(value, ensure_ascii=False)
    if len(text) > MAX_CONTEXT:
        raise ValueError(f'전체 입력 {len(text):,}자가 AI_MAX_CONTEXT_CHARS={MAX_CONTEXT:,}를 초과했습니다. 요구사항을 생략하지 않았습니다.')
    return text


def validate_evidence(content, sources):
    evidence = content.get('evidence', [])
    errors = []
    if not isinstance(evidence, list) or not evidence:
        return ['산출물 필드별 원문 근거가 없습니다.']
    for item in evidence:
        if not isinstance(item, dict): errors.append('근거 형식 오류'); continue
        quote = item.get('quote','')
        if item.get('reqKey') not in sources or not quote or quote not in sources[item['reqKey']]:
            errors.append('원문에 없는 근거 구절 또는 요구사항 ID입니다.')
        path = item.get('field','')
        current = content
        try:
            for part in path.split('.'):
                current = current[int(part)] if isinstance(current, list) else current[part]
        except (KeyError, TypeError, ValueError, IndexError): errors.append(f'존재하지 않는 산출물 필드: {path}')
    return errors


def numeric_concerns(content, source):
    # Units included: 30% and 0.3% are deliberately distinct.
    pattern = r'\d+(?:\.\d+)?\s*(?:%|ms|초|분|mm|cm|m/s)(?:\s*(?:이상|이하|초과|미만))?'
    normalize = lambda s: re.sub(r'\s+', '', s)
    known = {normalize(x) for x in re.findall(pattern, source)}
    found = {normalize(x) for x in re.findall(pattern, json.dumps(content, ensure_ascii=False))}
    return [f'수치·단위·경계 조건의 근거 확인 필요: {x}' for x in sorted(found-known)]
