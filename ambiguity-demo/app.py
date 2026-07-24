"""요구사항 모호성 해결 데모 — 백엔드 (FastAPI).

DESIGN.md 핵심 기능 1(모호성 해결) 흐름을 텍스트 입력으로 끝까지 보여주는 최소 데모.
요구사항 원문(여러 줄) → 조항 단위 분리 → 각 조항 모호성 판정 → (프론트에서) 해결/넘어가기.

판정기:
- Ollama(qwen3:8b)가 떠 있으면 실제 LLM으로 판정 (ai-model/main.py와 같은 프롬프트).
- 안 떠 있으면 규칙 기반 mock으로 폴백 (모델 없이도 화면이 도는지 확인용).
"""
import json
import os
import re
import urllib.request

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

HERE = os.path.dirname(os.path.abspath(__file__))
OLLAMA_GEN = "http://localhost:11434/api/generate"
OLLAMA_TAGS = "http://localhost:11434/api/tags"
MODEL_NAME = "qwen3:8b"

SYSTEM_PROMPT = """당신은 반도체 장비 요구사항 명세서에서 모호한 표현을 찾는 검토자입니다.

[도메인 용어] 아래는 이 시스템(VCS)의 정상 용어다. 모르는 말이라는 이유로 모호로 판정하지 마라.
- VCS: AMR들을 제어하는 차량 제어 시스템 / AMR: Probe Card를 옮기는 무인이송로봇
- newAMOS: 상위 시스템(MES), VCS에 Task를 내림 / Task·Job: 이송 작업 단위
- Stocker·Prober: 설비 노드(Prober에서 EDS 테스트) / 이적재: AMR의 적재·하역 동작 / NACK: 거절 응답
- 태스크 스텝: ASSIGNED → MOVE_TO_LOAD → MOVE_TO_UNLOAD → LOAD → UNLOAD

다음 유형 중 하나로 분류하세요: 정량 기준 부재 / 모호한 정도부사 / 주어·주체 불명확 / 조건 발생 시점 불명확 / 예외·경계 조건 누락 / 접속사 범위 모호 / 시간·일정 모호 / 해당없음

반드시 아래 JSON 형식으로만 답하세요:
{"ambiguous": true or false, "type": "...", "reason": "..."}
"""

# mock 폴백 규칙 (키워드 → 유형)
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

app = FastAPI(title="모호성 해결 데모")


class AnalyzeReq(BaseModel):
    text: str


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
    req = urllib.request.Request(
        OLLAMA_GEN, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.loads(r.read())
    return json.loads(data["response"])


def mock_analyze(sentence):
    for kws, typ in MOCK_RULES:
        for kw in kws:
            if kw in sentence:
                return {"ambiguous": True, "type": typ,
                        "reason": f"'{kw}' 표현이 기준 없이 모호함"}
    return {"ambiguous": False, "type": None, "reason": None}


def split_clauses(text):
    clauses = []
    for line in text.splitlines():
        s = re.sub(r'^\s*(\d+[.)]|[-•·])\s*', '', line.strip())
        if s:
            clauses.append(s)
    return clauses


@app.post("/api/analyze")
def analyze(req: AnalyzeReq):
    mode = "ollama" if ollama_up() else "mock"
    judge = call_ollama if mode == "ollama" else mock_analyze
    clauses = []
    for i, text in enumerate(split_clauses(req.text), 1):
        try:
            res = judge(text)
        except Exception as e:
            res = {"ambiguous": False, "type": None, "reason": f"분석 실패: {e}"}
        clauses.append({
            "id": f"REQ-2026-{i:03d}",
            "text": text,
            "ambiguous": bool(res.get("ambiguous")),
            "type": res.get("type"),
            "reason": res.get("reason"),
        })
    return {"mode": mode, "clauses": clauses}


# 빌드된 React 앱(web/dist)이 있으면 그대로 서빙 (/ 에서 UI 제공).
# 개발 중에는 `npm run dev`(:5173)를 쓰고 /api 는 프록시로 이 백엔드에 붙는다.
_DIST = os.path.join(HERE, "web", "dist")
if os.path.isdir(_DIST):
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="web")
