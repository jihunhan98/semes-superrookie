"""AI 서버 (FastAPI) — 문장 하나의 모호성을 판정한다.

Spring Boot 백엔드가 조항마다 이 서버의 POST /analyze 를 호출한다.
Ollama(qwen3:8b)가 떠 있으면 실제 LLM 판정, 없으면 규칙 기반 mock.
(프론트/문서 분리는 하지 않는다 — AI 판정만 담당하는 무상태 서버)
"""
import json
import urllib.request

from fastapi import FastAPI
from pydantic import BaseModel

OLLAMA_GEN = "http://localhost:11434/api/generate"
OLLAMA_TAGS = "http://localhost:11434/api/tags"
MODEL_NAME = "qwen3:8b"

SYSTEM_PROMPT = """당신은 반도체 장비 요구사항 명세서에서 모호한 표현을 찾는 검토자입니다.

[도메인 용어] 아래는 이 시스템(VCS)의 정상 용어다. 모르는 말이라는 이유로 모호로 판정하지 마라.
- VCS: AMR들을 제어하는 차량 제어 시스템 / AMR: Probe Card(PCard)를 옮기는 무인이송로봇
- newAMOS: 상위 시스템(MES), VCS에 Task를 내림 / Task·Job: 이송 작업 단위
- Stocker·Prober: 설비 노드. Prober에서 EDS 테스트를 수행한다
- LOAD: AMR이 PCard를 설비(Prober 또는 Stocker)로 옮겨 싣는 동작 (AMR → 설비)
- UNLOAD: 설비에서 PCard를 AMR으로 빼내는 동작 (설비 → AMR)
- 이적재: LOAD/UNLOAD 등 적재·하역 동작 / NACK: 거절 응답
- 태스크 스텝: ASSIGNED → MOVE_TO_LOAD → MOVE_TO_UNLOAD → LOAD → UNLOAD

모호 유형(하나 선택): 정량 기준 부재 / 모호한 정도부사 / 주어·주체 불명확 / 조건 발생 시점 불명확 / 예외·경계 조건 누락 / 접속사 범위 모호 / 시간·일정 모호 / 해당없음

각 문장을 판정해 아래 JSON으로만 답하라. 모호하면 "suggestion"에 명확하게 다시 쓴 예시 문장(이렇게 작성하라는 예)을 넣어라. 모호하지 않으면 type/reason/suggestion 은 null.
{"ambiguous": true or false, "type": "...", "reason": "...", "suggestion": "..."}

예시)
입력: "장비는 충분한 내구성을 가져야 한다."
출력: {"ambiguous": true, "type": "정량 기준 부재", "reason": "'충분한'의 기준이 수치로 정의되지 않음", "suggestion": "장비는 MTBF 10,000시간 이상의 내구성을 가져야 한다."}

입력: "AMR은 IEC 60204-1 안전 규격을 만족해야 한다."
출력: {"ambiguous": false, "type": null, "reason": null, "suggestion": null}
"""

MOCK_RULES = [
    (["충분", "적당", "우수", "원활", "안정적"], "정량 기준 부재"),
    (["적절히", "가능한 한", "신속", "빠르게"], "모호한 정도부사"),
    (["필요시", "필요한 경우", "필요에 따라"], "조건 발생 시점 불명확"),
    (["빠른 시일", "적시", "조속", "추후"], "시간·일정 모호"),
    (["및/또는", "and/or"], "접속사 범위 모호"),
    (["정상 동작", "정상적으로", "정상 처리"], "예외·경계 조건 누락"),
    (["관련 부서", "협의하여"], "주어·주체 불명확"),
    (["몇 단계", "몇 개", "몇 번"], "정량 기준 부재"),
]

app = FastAPI(title="AI 서버 (모호성 판정)")


class AnalyzeReq(BaseModel):
    sentence: str


class AnalyzeRes(BaseModel):
    mode: str
    ambiguous: bool
    type: str | None = None
    reason: str | None = None
    suggestion: str | None = None


def ollama_up():
    try:
        urllib.request.urlopen(OLLAMA_TAGS, timeout=2)
        return True
    except Exception:
        return False


def call_ollama(sentence):
    prompt = f'{SYSTEM_PROMPT}\n입력: "{sentence}"\n출력:'
    payload = json.dumps({
        "model": MODEL_NAME, "prompt": prompt,
        "format": "json", "stream": False, "think": False,
    }).encode("utf-8")
    req = urllib.request.Request(OLLAMA_GEN, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.loads(r.read())
    return json.loads(data["response"])


def mock_analyze(sentence):
    for kws, typ in MOCK_RULES:
        for kw in kws:
            if kw in sentence:
                return {"ambiguous": True, "type": typ,
                        "reason": f"'{kw}' 표현이 기준 없이 모호함",
                        "suggestion": f"'{kw}'을(를) 구체 수치·조건으로 바꿔 다시 작성하세요."}
    return {"ambiguous": False, "type": None, "reason": None, "suggestion": None}


@app.get("/health")
def health():
    return {"status": "ok", "mode": "ollama" if ollama_up() else "mock"}


@app.post("/analyze", response_model=AnalyzeRes)
def analyze(req: AnalyzeReq):
    mode = "ollama" if ollama_up() else "mock"
    try:
        res = call_ollama(req.sentence) if mode == "ollama" else mock_analyze(req.sentence)
    except Exception as e:
        res = {"ambiguous": False, "type": None, "reason": f"분석 실패: {e}", "suggestion": None}
    return AnalyzeRes(mode=mode, ambiguous=bool(res.get("ambiguous")),
                      type=res.get("type"), reason=res.get("reason"), suggestion=res.get("suggestion"))
