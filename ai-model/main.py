"""요구사항 검토 AI 서버 (FastAPI).

Spring Boot 백엔드가 요구사항 등록/수정 시 이 서버를 호출한다.
Ollama 가 떠 있으면 LLM 판정을 얹고, 없으면 규칙 기반 결과만 반환한다.
어느 경우든 응답 형태는 같다 — 백엔드는 차이를 몰라도 된다.

실행:
    uvicorn main:app --host 0.0.0.0 --port 8001
"""

from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.request

from fastapi import FastAPI
from pydantic import BaseModel, Field

import rules

log = logging.getLogger("ai-model")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct")
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "20"))
# 개발 중 로딩 UI를 확인하기 위한 인위적 지연(초). 폐쇄망 실서버에서는 0.
ANALYZE_DELAY = float(os.getenv("ANALYZE_DELAY", "0"))

app = FastAPI(title="요구사항 검토 AI", version="1.0")


# ── 요청/응답 스키마 ──────────────────────────────────────────────

class ExistingRequirement(BaseModel):
    reqKey: str
    content: str


class AnalyzeRequest(BaseModel):
    content: str = Field(..., description="검토할 요구사항 본문")
    # 확정본 수정 시에만 채워진다. 있으면 '변경분만' 검토한다.
    baseContent: str | None = Field(None, description="수정 전 확정본")
    reason: str | None = Field(None, description="수정 사유")
    # 상충 검출용 — 같은 프로젝트의 기존 요구사항
    existing: list[ExistingRequirement] = Field(default_factory=list)


class FindingOut(BaseModel):
    findingType: str
    targetSpan: str
    reason: str
    suggestion: str
    conflictReqKey: str | None = None


class AnalyzeResponse(BaseModel):
    findings: list[FindingOut]
    # 제안이 모두 반영된 문장 — 확정 화면의 "확정될 본문"에 그대로 채워진다.
    draftContent: str
    # rule | llm — 어느 경로로 판정했는지(운영 중 확인용)
    engine: str
    scope: str  # full | diff
    elapsedMs: int


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "ollama": _ollama_available(), "model": OLLAMA_MODEL}


@app.get("/types")
def types() -> dict:
    """검출 유형 목록 — 프론트 안내 문구와 동일한 순서."""
    return {"types": rules.ALL_TYPES}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    started = time.monotonic()

    if ANALYZE_DELAY > 0:
        time.sleep(ANALYZE_DELAY)

    # 확정본 수정이면 바뀐 부분만 본다. 이미 합의된 문장을 다시 건드리지 않기 위함.
    target, scope = _analysis_target(req)

    existing = [e.model_dump() for e in req.existing]
    findings = rules.detect(target, existing)

    engine = "rule"
    if _ollama_available():
        try:
            extra = _ask_llm(target, req.reason)
            if extra:
                findings = _merge(findings, extra)
                engine = "llm"
        except Exception as e:  # LLM 실패는 치명적이지 않다 — 규칙 결과로 계속 간다.
            log.warning("LLM 판정 실패, 규칙 결과만 사용: %s", e)

    # draft 는 항상 '전체 본문' 기준으로 만든다 (화면의 본문 칸을 채우는 값이므로).
    draft = rules.build_draft(req.content, findings)

    elapsed = int((time.monotonic() - started) * 1000)
    log.info("analyze scope=%s engine=%s findings=%d %dms", scope, engine, len(findings), elapsed)

    return AnalyzeResponse(
        findings=[FindingOut(**f.to_dict()) for f in findings],
        draftContent=draft,
        engine=engine,
        scope=scope,
        elapsedMs=elapsed,
    )


# ── 내부 구현 ────────────────────────────────────────────────────

def _analysis_target(req: AnalyzeRequest) -> tuple[str, str]:
    """검토 대상 텍스트와 범위를 정한다.

    최초 확정: 본문 전체.
    확정본 수정: 확정본에 없던 부분(=이번에 추가된 문장)만. 사유도 함께 본다.
    """
    if not req.baseContent:
        return req.content, "full"

    added = _added_part(req.baseContent, req.content)
    if not added.strip():
        # 추가 없이 문장을 고친 경우 — 전체를 보는 편이 안전하다.
        return req.content, "full"

    if req.reason:
        return f"{added}\n(수정 사유: {req.reason})", "diff"
    return added, "diff"


def _added_part(base: str, current: str) -> str:
    """current 에서 base 에 없는 뒷부분을 잘라낸다(단순 접두 비교)."""
    if current.startswith(base):
        return current[len(base):]
    # 접두가 아니면 문장 단위로 새로 등장한 것만 모은다.
    base_sentences = {s.strip() for s in base.split(".") if s.strip()}
    added = [s.strip() for s in current.split(".") if s.strip() and s.strip() not in base_sentences]
    return ". ".join(added)


_SYSTEM_PROMPT = """당신은 반도체 장비 소프트웨어(VCS/AMR) 요구사항을 검토하는 전문가다.
주어진 요구사항 문장에서 개발자와 고객이 서로 다르게 해석할 수 있는 부분을 찾아라.

검출 유형은 다음 중 하나만 사용한다:
정량 기준 부재, 모호한 정도부사, 주어·주체 불명확, 조건 발생 시점 불명확,
예외·경계 조건 누락, 접속사 범위 모호, 시간·일정 모호

반드시 아래 JSON 형식으로만 답한다. 문제가 없으면 findings 를 빈 배열로 둔다.
{"findings":[{"findingType":"유형","targetSpan":"문제가 된 구절","reason":"왜 문제인지","suggestion":"어떻게 바꾸면 좋은지"}]}

targetSpan 은 반드시 원문에 그대로 등장하는 구절이어야 한다."""


def _ollama_available() -> bool:
    try:
        with urllib.request.urlopen(f"{OLLAMA_URL}/api/tags", timeout=1.5) as res:
            return res.status == 200
    except Exception:
        return False


def _ask_llm(content: str, reason: str | None) -> list[rules.Finding]:
    user = f"요구사항: {content}"
    if reason:
        user += f"\n수정 사유: {reason}"

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": f"{_SYSTEM_PROMPT}\n\n{user}",
        "format": "json",
        "stream": False,
    }
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{OLLAMA_URL}/api/generate",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=OLLAMA_TIMEOUT) as res:
        raw = json.loads(res.read().decode("utf-8"))

    parsed = json.loads(raw.get("response") or "{}")
    out: list[rules.Finding] = []
    for item in parsed.get("findings") or []:
        ftype = item.get("findingType")
        span = item.get("targetSpan") or ""
        if ftype not in rules.ALL_TYPES:
            continue
        # 원문에 없는 구절을 LLM 이 만들어낸 경우는 버린다(환각 방지).
        if span and span not in content:
            continue
        out.append(rules.Finding(
            ftype, span,
            item.get("reason") or "",
            item.get("suggestion") or "",
        ))
    return out


def _merge(base: list[rules.Finding], extra: list[rules.Finding]) -> list[rules.Finding]:
    """규칙 결과를 우선하고, LLM 이 추가로 찾은 것만 덧붙인다."""
    seen = {(f.finding_type, f.target_span) for f in base}
    merged = list(base)
    for f in extra:
        key = (f.finding_type, f.target_span)
        if key in seen:
            continue
        seen.add(key)
        merged.append(f)
    return merged
