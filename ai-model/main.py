import json
import urllib.request

from fastapi import FastAPI
from pydantic import BaseModel

OLLAMA_URL = "http://localhost:11434/api/generate"
# 워크스테이션(P4000 8GB)용 1차 후보 — Qwen3-8B.
# 준비: `./setup_ollama.sh` (= ollama pull qwen3:8b). 스파이크 검증본은 qwen2.5:7b-instruct.
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

예시)
입력: "장비는 충분한 내구성을 가져야 한다."
출력: {"ambiguous": true, "type": "정량 기준 부재", "reason": "충분한의 기준이 수치로 정의되지 않음"}

입력: "장비는 IEC 60204-1 규격을 만족해야 한다."
출력: {"ambiguous": false, "type": null, "reason": null}
"""

app = FastAPI(title="AI 추론 서버 (모호성 검출기 스파이크)")


class AnalyzeRequest(BaseModel):
    sentence: str


class AnalyzeResponse(BaseModel):
    ambiguous: bool
    type: str | None = None
    reason: str | None = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    prompt = f'{SYSTEM_PROMPT}\n입력: "{req.sentence}"\n출력:'
    payload = json.dumps({
        "model": MODEL_NAME,
        "prompt": prompt,
        "format": "json",
        "stream": False,
        "think": False,  # Qwen3 thinking 모드 OFF (JSON 출력 안정 + 속도)
    }).encode("utf-8")

    request = urllib.request.Request(
        OLLAMA_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request) as resp:
        data = json.loads(resp.read())

    result = json.loads(data["response"])
    return AnalyzeResponse(**result)
