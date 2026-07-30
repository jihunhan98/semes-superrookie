"""
AI 추론 서버 (FastAPI) — 핵심 기능 1: 모호성 검출

DESIGN.md 2장 스펙 구현:
  - 2.1 모호성 유형 분류(7종 taxonomy)
  - 2.2 검출: 문장 하나를 받아 모호 여부 + findings[](span/type/reason) 출력
  - 2.5 입출력 예시의 JSON 형식

이 서버는 무상태(stateless)다. 문장 하나를 받아 구조화 JSON 하나를 돌려줄 뿐,
조항 분리·REQ-ID 부여·취합·저장은 백엔드(Spring Boot)가 담당한다.

판정 엔진(engine)은 두 가지를 지원하며, 같은 형식(JSON)으로 결과를 낸다:
  - "local"      : 사내 워크스테이션의 Ollama(qwen3:8b) 로컬 LLM
  - "playground" : 사내 LLM API 서비스(OpenAI 호환 엔드포인트)
어느 쪽도 붙지 않으면 규칙 기반 mock으로 폴백한다(개발/시연이 항상 되도록).
반출 차단 환경이라 둘 다 사내 서버이며, 외부(Claude/GPT) API는 쓰지 않는다.
"""
from __future__ import annotations

import json
import re
import socket
import urllib.error
import urllib.request
from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── 엔진 1: 로컬 Ollama ─────────────────────────────────────────────────
OLLAMA_URL = "http://localhost:11434"
OLLAMA_MODEL = "qwen3:8b"

# ── 엔진 2: 사내 LLM API 서비스 (OpenAI 호환) ────────────────────────────
# OpenAI 파이썬 라이브러리와 동일한 규격(/v1/chat/completions)을 표준 라이브러리로 호출.
#   client = OpenAI(api_key="EMPTY", base_url="http://INTERNAL-LLM-HOST:6100/v1")
#   client.chat.completions.create(model="gpt-4", messages=[...])
PLAYGROUND_BASE = "http://INTERNAL-LLM-HOST:6100/v1"
PLAYGROUND_MODEL = "gpt-4"   # 서버가 서빙하는 모델명(gpt-oss 등). 서버에 맞게 조정.
PLAYGROUND_KEY = "EMPTY"

# ── DESIGN 2.1 모호성 유형 (7종) ─────────────────────────────────────────
AMBIGUITY_TYPES = [
    "정량 기준 부재",        # 수치·기준값 없이 정성적으로만 표현
    "모호한 정도부사",       # 사람마다 기준이 다른 부사(적절히, 가능한 한 빠르게)
    "주어/주체 불명확",      # 누가 수행하는지 미명시
    "조건 발생 시점 불명확",  # 트리거 조건 미정의
    "예외/경계 조건 누락",    # 정상만 정의, 예외 없음
    "접속사 범위 모호",      # and/or 처리 범위 불명확
    "시간·일정 모호",        # 구체적 기한 없음
]

# ── 도메인 용어집: LLM이 VCS 도메인 문장을 오판하지 않게 알려준다 ──────────
GLOSSARY = """[도메인 용어집 — 아래는 모호한 표현이 '아니다']
- VCS: Vehicle Control System (AMR 제어 시스템)
- AMR: 자율주행 이송 로봇
- newAMOS: 상위 제어 시스템(호스트)
- Probe Card: AMR이 이송하는 대상물
- 태스크(Task)/스텝(Step): 이송 작업 단위와 세부 단계
- LOAD/UNLOAD/이적재: 적재/하역/재적재 동작
- NACK: 통신 거절 응답
- Stocker/Prober: 카드 보관소/검사 장비
위 용어 자체는 이미 정의된 도메인 용어이므로 모호하다고 판정하지 말 것."""

SYSTEM_PROMPT = f"""너는 반도체 장비사(SEMES)의 요구사항 명세서 검토 AI다.
고객사(삼성전자)가 작성한 요구사항 하나(요구사항의 '내용'과 '비고'로 구성)를 받아,
그 안에서 사람마다 다르게 해석될 수 있는 '모호한 표현'을 모두 찾아낸다.

- '분류'는 이 요구사항이 속한 기능군일 뿐 배경 맥락이다. 분류 자체는 판정 대상이 아니다.
- '내용'과 '비고'의 문장들만 판정한다. 여러 문장에 걸쳐 모호한 곳이 여러 개일 수 있다.

{GLOSSARY}

[모호성 유형은 아래 7종 중 하나로만 분류한다]
{chr(10).join(f"- {t}" for t in AMBIGUITY_TYPES)}

[판정 규칙]
1. 내용/비고에 모호한 부분이 하나라도 있으면 ambiguous=true, 없으면 false.
2. 모호한 부분마다 findings 배열에 항목을 추가한다.
   - span: 내용/비고 원문에서 모호한 '부분 문자열'(그대로 발췌)
   - type: 위 7종 중 하나(정확히 그 문자열)
   - reason: 왜 모호한지 한 문장(근거)
3. 근거를 지어내지 말 것. 모호하지 않으면 findings는 빈 배열.
4. suggestion: 모호함이 있으면, 이 요구사항을 어떻게 보완하면 명확해지는지
   한두 문장 요약. 없으면 빈 문자열.

[출력은 반드시 아래 JSON 하나만. 다른 말/설명 금지]
{{"ambiguous": true, "findings": [{{"span": "...", "type": "...", "reason": "..."}}], "suggestion": "..."}}"""


# ── 규칙 기반 mock (Ollama 없을 때 폴백) ──────────────────────────────────
# (키워드, 유형, 근거, 고쳐쓰기 힌트)
MOCK_RULES: list[tuple[str, str, str, str]] = [
    ("충분한", "정량 기준 부재", "'충분한'의 기준값이 없음", "정량 기준(예: MTBF ≥ 10,000h)으로 명시"),
    ("적절히", "모호한 정도부사", "'적절히'의 판단 기준이 사람마다 다름", "구체적 조치 절차/기준으로 명시"),
    ("적당히", "모호한 정도부사", "'적당히'의 판단 기준이 없음", "구체적 수치·절차로 명시"),
    ("가능한 한", "모호한 정도부사", "'가능한 한'의 범위가 불명확", "구체적 목표치로 명시"),
    ("빠른 시일", "시간·일정 모호", "'빠른 시일'의 기한이 없음", "구체적 기한(예: 30초 이내)으로 명시"),
    ("빠르게", "시간·일정 모호", "'빠르게'의 기준 시간이 없음", "구체적 시간 상한으로 명시"),
    ("적시에", "시간·일정 모호", "'적시에'의 시점이 정의되지 않음", "명확한 트리거·기한으로 명시"),
    ("관련 부서", "주어/주체 불명확", "'관련 부서'가 어느 부서인지 불명확", "책임 주체를 명시"),
    ("협의하여", "주어/주체 불명확", "협의 주체·방법이 불명확", "협의 주체와 확정 절차를 명시"),
    ("필요한 경우", "조건 발생 시점 불명확", "'필요한 경우'의 트리거 조건이 없음", "발생 조건을 구체적으로 정의"),
    ("필요시", "조건 발생 시점 불명확", "'필요시'의 조건이 정의되지 않음", "발생 조건을 구체적으로 정의"),
    ("정상 동작", "예외/경계 조건 누락", "정상만 정의되고 예외 케이스가 없음", "예외·경계 상황의 동작을 정의"),
    ("정상적으로", "예외/경계 조건 누락", "정상만 정의되고 예외가 없음", "예외·경계 상황의 동작을 정의"),
    ("및/또는", "접속사 범위 모호", "and/or 처리 범위가 불명확", "지원 조합을 명확히 구분해 기술"),
    ("등을", "접속사 범위 모호", "'등'이 가리키는 범위가 불명확", "대상 항목을 열거로 확정"),
    ("등의", "접속사 범위 모호", "'등'이 가리키는 범위가 불명확", "대상 항목을 열거로 확정"),
    ("필수 요건", "정량 기준 부재", "'필수 요건'이 무엇인지 정의되지 않음", "요건 항목을 구체적으로 열거"),
    ("간주한다", "예외/경계 조건 누락", "실제 확인 없이 '확인된 것으로 간주' — 예외 상황이 정의되지 않음", "확인 절차·실패 시 처리를 정의"),
    ("허용 여부", "조건 발생 시점 불명확", "'허용 여부'의 판단 기준이 정의되지 않음", "허용 조건을 구체적으로 정의"),
    ("상세 제약 조건", "정량 기준 부재", "'상세 제약 조건'의 실제 항목이 정의되지 않음", "제약 항목을 구체적으로 열거"),
]

app = FastAPI(title="요구사항 모호성 검출 AI 서버", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 백엔드(Spring)가 호출. 사내 로컬 서버라 전체 허용.
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    """요구사항 하나(docx 표의 한 행). 내용+비고를 통째로 판정한다."""
    category: str = Field("", description="분류 — 배경 맥락(판정 대상 아님)")
    content: str = Field("", description="내용 — 요구사항 본문")
    remark: str = Field("", description="비고 — 제약·정의 항목")
    engine: str = Field("local", description="판정 엔진: local(Ollama) | playground(사내 LLM API)")


class Finding(BaseModel):
    span: str
    type: str
    reason: str


class AnalyzeResponse(BaseModel):
    mode: str = Field(..., description="ollama | playground | mock — 실제로 응답한 판정기")
    ambiguous: bool
    findings: list[Finding] = []
    suggestion: str = ""


def _http_post_json(url: str, payload: dict, timeout: float, headers: dict | None = None) -> dict:
    """표준 라이브러리(urllib)로 JSON POST. (httpx/openai 등 외부 의존성 없음)"""
    data = json.dumps(payload).encode("utf-8")
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, headers=h, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _reachable(url: str, timeout: float = 2.0) -> bool:
    """host:port로 소켓 연결이 되는지 빠르게 확인(엔진 가용성 프리체크)."""
    try:
        u = urlparse(url)
        port = u.port or (443 if u.scheme == "https" else 80)
        with socket.create_connection((u.hostname, port), timeout=timeout):
            return True
    except Exception:
        return False


def ollama_up() -> bool:
    try:
        with urllib.request.urlopen(f"{OLLAMA_URL}/api/tags", timeout=1.5) as r:
            return r.status == 200
    except Exception:
        return False


def _build_user_msg(category: str, content: str, remark: str) -> str:
    """요구사항 한 건(분류/내용/비고)을 LLM 입력 텍스트로 만든다."""
    lines = []
    if category.strip():
        lines.append(f"분류: {category.strip()}")
    if content.strip():
        lines.append(f"[내용]\n{content.strip()}")
    if remark.strip():
        lines.append(f"[비고]\n{remark.strip()}")
    return "\n\n".join(lines)


def call_ollama(category: str, content: str, remark: str) -> dict:
    """Ollama에 요구사항 한 건의 판정을 요청하고 JSON을 파싱한다."""
    body = _http_post_json(
        f"{OLLAMA_URL}/api/chat",
        {
            "model": OLLAMA_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": _build_user_msg(category, content, remark)},
            ],
            "stream": False,
            "think": False,          # qwen3 사고 과정 출력 끄기(속도)
            "format": "json",        # JSON 강제
            "options": {"temperature": 0},
        },
        timeout=120,
    )
    data = _parse_json(body["message"]["content"])
    return _normalize(data)


def call_playground(category: str, content: str, remark: str) -> dict:
    """사내 LLM API 서비스(OpenAI 호환)에 Chat Completions로 판정을 요청한다.

    OpenAI 라이브러리의 client.chat.completions.create(...) 와 동일한 HTTP 요청을
    표준 라이브러리로 보낸다(POST /v1/chat/completions).
    """
    body = _http_post_json(
        f"{PLAYGROUND_BASE}/chat/completions",
        {
            "model": PLAYGROUND_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": _build_user_msg(category, content, remark)},
            ],
            "temperature": 0,
        },
        timeout=120,
        headers={"Authorization": f"Bearer {PLAYGROUND_KEY}"},
    )
    data = _parse_json(body["choices"][0]["message"]["content"])
    return _normalize(data)


def _parse_json(text: str) -> dict:
    """모델이 앞뒤에 군더더기를 붙여도 첫 JSON 객체를 뽑아 파싱한다."""
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"\{.*\}", text, re.S)
        if m:
            return json.loads(m.group(0))
        raise


def _normalize(data: dict) -> dict:
    """모델 출력에서 스키마에 필요한 필드만 안전하게 정리한다."""
    findings = []
    for f in data.get("findings", []) or []:
        t = str(f.get("type", "")).strip()
        if t not in AMBIGUITY_TYPES:
            t = _closest_type(t)
        findings.append({
            "span": str(f.get("span", "")).strip(),
            "type": t,
            "reason": str(f.get("reason", "")).strip(),
        })
    ambiguous = bool(data.get("ambiguous", len(findings) > 0))
    return {
        "ambiguous": ambiguous,
        "findings": findings if ambiguous else [],
        "suggestion": str(data.get("suggestion", "")).strip() if ambiguous else "",
    }


def _closest_type(t: str) -> str:
    """모델이 유형명을 살짝 다르게 쓰면 가장 근접한 정식 유형으로 맞춘다."""
    for canonical in AMBIGUITY_TYPES:
        if t and (t in canonical or canonical in t):
            return canonical
    return AMBIGUITY_TYPES[0]  # 최후 폴백: 정량 기준 부재


def mock_analyze(category: str, content: str, remark: str) -> dict:
    text = f"{content}\n{remark}"
    findings, hints = [], []
    for kw, typ, reason, hint in MOCK_RULES:
        if kw in text:
            findings.append({"span": kw, "type": typ, "reason": reason})
            hints.append(hint)
    ambiguous = len(findings) > 0
    suggestion = ""
    if ambiguous:
        suggestion = f"다음을 보완: {', '.join(dict.fromkeys(hints))}."
    return {"ambiguous": ambiguous, "findings": findings, "suggestion": suggestion}


@app.get("/health")
def health():
    """두 엔진의 가용성. 프론트가 어떤 엔진이 실제로 붙는지 표시하는 데 쓴다."""
    return {
        "local": "ollama" if ollama_up() else "mock",
        "playground": "up" if _reachable(PLAYGROUND_BASE) else "down",
        "ollama_model": OLLAMA_MODEL,
        "playground_model": PLAYGROUND_MODEL,
    }


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    category = (req.category or "").strip()
    content = (req.content or "").strip()
    remark = (req.remark or "").strip()
    if not content and not remark:
        return AnalyzeResponse(mode="mock", ambiguous=False)

    engine = (req.engine or "local").lower()

    # 엔진 2: 사내 LLM API 서비스(OpenAI 호환)
    if engine == "playground":
        if _reachable(PLAYGROUND_BASE):
            try:
                return AnalyzeResponse(mode="playground", **call_playground(category, content, remark))
            except Exception:
                pass  # 실패 시 mock 폴백
        return AnalyzeResponse(mode="mock", **mock_analyze(category, content, remark))

    # 엔진 1: 로컬 Ollama (기본)
    if ollama_up():
        try:
            return AnalyzeResponse(mode="ollama", **call_ollama(category, content, remark))
        except Exception:
            pass  # LLM 실패 시 mock으로 폴백
    return AnalyzeResponse(mode="mock", **mock_analyze(category, content, remark))
