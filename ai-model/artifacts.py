"""산출물 4종(SWVOC·기능·비기능 요구사항·Detail Design) 규칙 기반 생성기.

사내 LLM이 없거나 실패해도 산출물 화면이 빈 채로 뜨면 안 되므로, 개발 이슈의
제목·구절만으로 항상 채울 수 있는 기본 틀을 만든다. 내용은 정교하지 않지만
사람이 그 위에서 바로 고칠 수 있는 초안으로는 충분하다 — rules.py의 이슈 분할과
같은 철학(항상 결과를 낸다).

LLM 결과의 형태를 검증하는 is_valid_shape()도 여기 둔다 — LLM이 필드를 빼먹거나
JSON이 아닌 걸 보내면 그 결과를 버리고 규칙 결과로 되돌아가기 위함(main.py에서 사용).
"""

from __future__ import annotations


def _behaviors(quote: str) -> list[dict]:
    return [
        {"type": "기본", "item": "선행조건", "content": f"\"{quote}\"에 해당하는 정상 조건을 만족함"},
        {"type": "기본", "item": "시나리오", "content": "요청 수신 → 조건 확인 → 처리 → 결과 회신"},
        {"type": "기본", "item": "후행조건", "content": "요청이 정상 처리되고 결과가 회신됨"},
        {"type": "예외", "item": "선행조건", "content": "조건을 만족하지 못하거나 필수 값이 누락됨"},
        {"type": "예외", "item": "시나리오", "content": "오류로 판단 → 거부 또는 대기 처리"},
        {"type": "예외", "item": "후행조건", "content": "오류로 회신되거나 대기 상태로 등록됨"},
    ]


def voc(title: str, quote: str) -> dict:
    return {
        "description": f"'{title}' 관련 요구사항 취지를 정리한 내용 — 확정 본문에서 발췌.",
        "request": quote or title,
        "notes": "AI 서버 미응답으로 생성된 기본 초안입니다 — 직접 보완해주세요.",
    }


def functional(title: str, quote: str) -> dict:
    return {
        "description": f"'{title}' 흐름을 정의한다.",
        "role": f"'{quote or title}'에 해당하는 처리를 담당한다.",
        "purpose": "요청을 조건에 맞게 처리해 오배정·지연을 방지한다.",
        "behaviors": _behaviors(quote or title),
    }


def nonfunctional(title: str, quote: str) -> dict:
    base = functional(title, quote)
    base["constraints"] = "AI 서버 미응답으로 생성된 기본 초안입니다 — 성능·가용성 기준을 직접 채워주세요."
    return base


def detail_design(title: str, quote: str) -> dict:
    # sequence*Code는 Mermaid sequenceDiagram 코드 문자열 그대로다 — 화면에서 사람이
    # 직접 편집하는 자유 텍스트라, 구조화된 단계 배열이 아니라 완성된 코드를 낸다.
    before_code = (
        "sequenceDiagram\n"
        "    participant Host\n"
        "    participant TargetService\n"
        f"    Host->>TargetService: {title} 요청\n"
        "    TargetService-->>Host: 처리 결과 회신"
    )
    after_code = (
        "sequenceDiagram\n"
        "    participant Host\n"
        "    participant TargetService\n"
        f"    Host->>TargetService: {title} 요청\n"
        f"    Note right of TargetService: {quote or title} (변경)\n"
        "    TargetService-->>Host: 처리 결과 회신"
    )
    return {
        "description": f"'{title}' 변경 전/후 처리 흐름 — AI 서버 미응답으로 생성된 기본 초안입니다.",
        "classDiagram": [
            {"name": "TargetService", "fields": ["+ handle(req): Result"], "changed": True},
        ],
        "sequenceBeforeCode": before_code,
        "sequenceAfterCode": after_code,
    }


_GENERATORS = {
    "voc": voc,
    "functional": functional,
    "nonfunctional": nonfunctional,
    "detail-design": detail_design,
}


def generate_rule(type_: str, title: str, quote: str | None) -> dict:
    fn = _GENERATORS.get(type_)
    if fn is None:
        return {}
    return fn(title or "", quote or "")


def is_valid_shape(type_: str, content: object) -> bool:
    """LLM 응답이 화면이 기대하는 필드를 갖췄는지만 얕게 검사한다(내용의 질은 보지 않음)."""
    if not isinstance(content, dict):
        return False

    if type_ == "voc":
        return all(k in content for k in ("description", "request", "notes"))

    if type_ in ("functional", "nonfunctional"):
        if not all(k in content for k in ("description", "role", "purpose", "behaviors")):
            return False
        if not isinstance(content.get("behaviors"), list) or not content["behaviors"]:
            return False
        if type_ == "nonfunctional" and "constraints" not in content:
            return False
        return True

    if type_ == "detail-design":
        if not all(k in content for k in ("description", "classDiagram", "sequenceBeforeCode", "sequenceAfterCode")):
            return False
        return isinstance(content["sequenceBeforeCode"], str) and isinstance(content["sequenceAfterCode"], str)

    return False
