"""규칙 기반 요구사항 검토기.

사내 LLM이 없거나 응답이 실패해도 항상 결과를 내야 하므로, 이 모듈이 기본
동작이 된다. 검출 유형은 DESIGN.md 5.1.1 / spike-ambiguity-detector.md 와 동일하다.

각 규칙은 (유형, 대상 구절, 이유, 제안, 치환문구) 를 만들어 낸다. 치환문구가 있으면
`build_draft()` 가 원문의 해당 구절을 치환해서 "AI 제안이 반영된 문장"을 만든다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# 검출 유형 — 프론트 배지 라벨과 문자열이 그대로 일치해야 한다.
T_QUANT = "정량 기준 부재"
T_ADVERB = "모호한 정도부사"
T_SUBJECT = "주어·주체 불명확"
T_WHEN = "조건 발생 시점 불명확"
T_BOUNDARY = "예외·경계 조건 누락"
T_CONJ = "접속사 범위 모호"
T_TIME = "시간·일정 모호"
T_CONFLICT = "기존 요구사항과 상충"

ALL_TYPES = [
    T_QUANT, T_ADVERB, T_SUBJECT, T_WHEN,
    T_BOUNDARY, T_CONJ, T_TIME, T_CONFLICT,
]


@dataclass
class Finding:
    finding_type: str
    target_span: str
    reason: str
    suggestion: str
    conflict_req_key: str | None = None
    # 원문에서 target_span 을 이 문구로 바꾸면 제안이 반영된다. None 이면 문장 치환 불가
    # (예: 상충 — 문장만 고쳐서 해결되지 않으므로 협의가 필요하다).
    replacement: str | None = field(default=None)

    def to_dict(self) -> dict:
        return {
            "findingType": self.finding_type,
            "targetSpan": self.target_span,
            "reason": self.reason,
            "suggestion": self.suggestion,
            "conflictReqKey": self.conflict_req_key,
        }


# ── 사전(辭典) 규칙 ───────────────────────────────────────────────
# 도메인 표현 → (유형, 이유, 제안, 치환문구)
# VCS/AMR 도메인 어휘를 우선 담고, 일반적인 모호 표현을 뒤에 둔다.
PHRASE_RULES: list[tuple[str, str, str, str, str | None]] = [
    # (구절, 유형, 이유, 제안, 치환)
    ("가용한 AMR", T_QUANT,
     "무엇을 '가용'으로 볼지 판정 기준이 없어 해석이 갈릴 수 있음",
     "가용한 AMR = IDLE 상태이며 SoC(배터리 잔량)가 최소값 이상인 AMR",
     "IDLE 상태이며 SoC 최소값 이상인 AMR"),
    ("가용 AMR", T_QUANT,
     "무엇을 '가용'으로 볼지 판정 기준이 없어 해석이 갈릴 수 있음",
     "가용 AMR = IDLE 상태이며 SoC(배터리 잔량)가 최소값 이상인 AMR",
     "IDLE 상태이며 SoC 최소값 이상인 AMR"),
    ("가장 가까운", T_QUANT,
     "거리를 어떤 기준으로 잴지(직선거리/경로거리) 정의되지 않음",
     "가장 가까운 = 맵 경로상 맨해튼 거리 기준 최단 경로",
     "맵 경로상 맨해튼 거리 기준 최단 경로에 있는"),
    ("충분한", T_QUANT,
     "'충분함'의 수치 기준이 없어 검증이 불가능함",
     "정량 수치와 단위를 명시 (예: 24시간 연속 가동 기준)",
     None),
    ("적절히", T_ADVERB,
     "'적절히'의 판단 주체와 기준이 불명확함",
     "구체적인 조정 범위·기준값을 명시",
     None),
    ("적절한", T_ADVERB,
     "'적절한'의 판단 기준이 불명확함",
     "구체적인 기준값 또는 판정 조건을 명시",
     None),
    ("신속히", T_TIME,
     "구체적인 처리 시간·기한이 없어 해석이 갈릴 수 있음",
     "기준 시간을 명시 (예: 이상 감지 후 5분 이내)",
     "이상 감지 후 5분 이내에"),
    ("가능한 한 빠르게", T_TIME,
     "구체적인 처리 시간·기한이 없음",
     "목표 처리 시간을 수치로 명시",
     None),
    ("즉시", T_TIME,
     "'즉시'의 허용 지연 시간이 정의되지 않음",
     "허용 지연 시간을 명시 (예: 1초 이내)",
     None),
    ("주기적으로", T_TIME,
     "반복 주기가 정의되지 않음",
     "주기를 수치로 명시 (예: 10초 간격)",
     None),
    ("관련 부서", T_SUBJECT,
     "누가 수행·협의하는지 특정되지 않아 담당이 불분명함",
     "담당 조직을 구체적으로 명시",
     None),
    ("담당자가", T_SUBJECT,
     "어느 역할의 담당자인지 특정되지 않음",
     "역할명을 명시 (예: 설비 운영 담당자)",
     None),
    ("필요 시", T_WHEN,
     "어떤 조건에서 발생하는지가 정의되지 않음",
     "발생 조건을 판정 가능한 형태로 명시",
     None),
    ("이상 발생 시", T_WHEN,
     "'이상'의 판정 기준이 정의되지 않음",
     "이상으로 판정하는 조건을 명시 (예: 알람 코드 E-1xx 수신 시)",
     None),
    ("등을", T_CONJ,
     "'등'이 어디까지 포함하는지 범위가 열려 있음",
     "포함 대상을 열거하거나 범위를 한정",
     None),
    ("및", T_CONJ,
     "'및'이 묶는 대상의 범위가 모호할 수 있음",
     "대상을 나누어 문장을 분리하거나 괄호로 범위를 명시",
     None),
]

# 예외·경계 조건 누락 — 조건문인데 else 가 없는 경우를 잡는다.
_COND_PAT = re.compile(r"(경우에 한하여|경우에만|때에만|조건에서만)")
_EXCEPT_HINT = re.compile(r"(그 외|이외|아니면|그렇지 않으면|예외)")


def detect(content: str, existing: list[dict] | None = None) -> list[Finding]:
    """본문에서 불명확·상충을 검출한다. existing 은 같은 프로젝트의 기존 요구사항."""
    findings: list[Finding] = []
    seen: set[tuple[str, str]] = set()

    for phrase, ftype, reason, suggestion, replacement in PHRASE_RULES:
        if phrase not in content:
            continue
        key = (ftype, phrase)
        if key in seen:
            continue
        seen.add(key)
        findings.append(Finding(ftype, phrase, reason, suggestion, replacement=replacement))

    if _COND_PAT.search(content) and not _EXCEPT_HINT.search(content):
        findings.append(Finding(
            T_BOUNDARY,
            _COND_PAT.search(content).group(1),
            "조건을 만족하지 못하는 경우의 동작이 정의되지 않음",
            "조건 불충족 시의 동작(거부/대기/알림 등)을 함께 명시",
        ))

    findings.extend(_detect_conflicts(content, existing or []))
    return findings


# 상충 판정용 축.
# 같은 축(예: 선택 기준)에 대해 서로 다른 값을 쓰는 두 요구사항은 상충으로 본다.
# 표현이 달라도 같은 뜻인 경우가 많아 값마다 여러 패턴을 둔다.
_CONFLICT_AXES: list[tuple[str, dict[str, list[str]]]] = [
    ("선택·우선순위 기준", {
        "요청 순": ["요청 순", "요청순", "접수 순", "선착순"],
        "거리 순": ["가장 가까운", "가까운 순", "거리 순", "최단 거리", "최단 경로"],
        "배터리 잔량 순": ["SoC 높은 순", "SoC가 높은", "배터리 잔량 높은", "잔량이 많은"],
        "등록 순": ["등록 순", "등록순"],
    }),
]


def _axis_values(text: str, value_map: dict[str, list[str]]) -> list[str]:
    """텍스트에 등장하는 축 값을 canonical 이름으로 모은다."""
    found = []
    for canonical, patterns in value_map.items():
        if any(p in text for p in patterns):
            found.append(canonical)
    return found


def _detect_conflicts(content: str, existing: list[dict]) -> list[Finding]:
    out: list[Finding] = []
    for axis, value_map in _CONFLICT_AXES:
        mine = _axis_values(content, value_map)
        if not mine:
            continue
        for other in existing:
            req_key = other.get("reqKey") or ""
            theirs = _axis_values(other.get("content") or "", value_map)
            if not theirs or set(mine) == set(theirs):
                continue
            out.append(Finding(
                T_CONFLICT,
                req_key,
                f"{req_key}는 \"{theirs[0]}\"으로 {axis}을 정하는데, "
                f"이 요구사항은 \"{mine[0]}\"이라 배치될 수 있음",
                f"{axis}을 하나로 통일 — 문장 수정만으론 해결되지 않으므로 고객 협의 필요",
                conflict_req_key=req_key,
            ))
    return out


def build_draft(content: str, findings: list[Finding]) -> str:
    """제안이 반영된 문장을 만든다. 치환 가능한 항목만 실제로 바꾼다."""
    draft = content
    for f in findings:
        if f.replacement and f.target_span and f.target_span in draft:
            draft = draft.replace(f.target_span, f.replacement)
    return draft
