"""요구사항 검토 AI 서버 (FastAPI).

Spring Boot 백엔드가 요구사항 등록/수정 시 이 서버를 호출한다.
판정 경로는 세 갈래이고, 위에서부터 쓸 수 있는 것을 고른다.

  1. 사내 LLM API (GPT-OSS-120B · OpenAI 호환 Chat Completions)
  2. 로컬 Ollama
  3. 규칙 기반 — 위 둘이 다 없어도 항상 동작한다

어느 경로든 응답 형태는 같다 — 백엔드는 차이를 몰라도 된다. 실제로 어느 쪽이
답했는지는 응답의 `engine` 으로 확인한다.

실행:
    uvicorn main:app --host 0.0.0.0 --port 8001
"""

from __future__ import annotations

import json
import logging
import os
import socket
import time
import urllib.error
import urllib.parse
import urllib.request

from fastapi import FastAPI
from pydantic import BaseModel, Field

import rules

log = logging.getLogger("ai-model")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# ── 엔진 1: 사내 LLM API 서비스 (OpenAI 호환) ─────────────────────
# OpenAI 파이썬 라이브러리와 같은 규격이라, 아래 호출은 이것과 동등하다.
#   client = OpenAI(api_key="EMPTY", base_url="http://INTERNAL-LLM-HOST:6100/v1")
#   client.chat.completions.create(model=..., messages=[...])
# 폐쇄망 반출이 막혀 있어 외부 API는 못 쓰고, 이 사내 서비스만 쓸 수 있다.
LLM_API_BASE = os.getenv("LLM_API_BASE", "http://INTERNAL-LLM-HOST:6100/v1")
LLM_API_MODEL = os.getenv("LLM_API_MODEL", "gpt-4")  # 서버가 서빙하는 모델명에 맞춘다
LLM_API_KEY = os.getenv("LLM_API_KEY", "EMPTY")      # 사내 서비스는 인증 없이 EMPTY
LLM_API_TIMEOUT = float(os.getenv("LLM_API_TIMEOUT", "30"))

# ── 엔진 2: 로컬 Ollama ──────────────────────────────────────────
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct")
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "20"))

# auto(기본) | llm-api | ollama | rule — 어느 엔진을 쓸지 강제하고 싶을 때.
LLM_BACKEND = os.getenv("LLM_BACKEND", "auto").strip().lower()

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
    # rule | llm-api | ollama — 어느 경로로 판정했는지(운영 중 확인용)
    engine: str
    scope: str  # full | diff
    elapsedMs: int


@app.get("/health")
def health() -> dict:
    """어느 엔진이 실제로 붙어 있는지 — 폐쇄망 배포 후 첫 확인용."""
    return {
        "status": "ok",
        "backend": LLM_BACKEND,
        "llmApi": {"reachable": _llm_api_available(), "base": LLM_API_BASE, "model": LLM_API_MODEL},
        "ollama": {"reachable": _ollama_available(), "model": OLLAMA_MODEL},
        # 지금 요청이 오면 실제로 쓰일 엔진
        "active": _pick_engine(),
    }


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
    picked = _pick_engine()
    if picked != "rule":
        try:
            extra = _ask_llm(picked, target, req.reason)
            # 엔진이 실제로 응답했으면, 추가 검출이 0건이어도 그 엔진이 본 것이다.
            findings = _merge(findings, extra)
            engine = picked
        except Exception as e:  # LLM 실패는 치명적이지 않다 — 규칙 결과로 계속 간다.
            log.warning("%s 판정 실패, 규칙 결과만 사용: %s", picked, e)

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


def _pick_engine() -> str:
    """지금 쓸 수 있는 엔진을 고른다 — 사내 LLM 우선, 없으면 Ollama, 둘 다 없으면 규칙.

    사내 LLM을 우선하는 이유: 로컬 Qwen3-8B보다 GPT-OSS-120B 쪽이 한국어 판정 품질이
    낫고, 개발 PC마다 모델을 내려받아 둘 필요도 없기 때문. 다만 사내 서비스는 언제든
    내려갈 수 있어서, 매 요청 전에 도달 가능한지 확인하고 안 되면 아래로 내려간다.
    """
    if LLM_BACKEND == "rule":
        return "rule"
    if LLM_BACKEND == "llm-api":
        return "llm-api" if _llm_api_available() else "rule"
    if LLM_BACKEND == "ollama":
        return "ollama" if _ollama_available() else "rule"
    # auto
    if _llm_api_available():
        return "llm-api"
    if _ollama_available():
        return "ollama"
    return "rule"


def _reachable(url: str, timeout: float = 1.5) -> bool:
    """TCP 연결만 확인한다 — 사내 서비스는 헬스 엔드포인트가 없을 수 있어서."""
    try:
        u = urllib.parse.urlparse(url)
        port = u.port or (443 if u.scheme == "https" else 80)
        with socket.create_connection((u.hostname, port), timeout=timeout):
            return True
    except Exception:
        return False


# 엔진이 꺼져 있으면 연결 시도가 타임아웃까지 걸리는데, 요구사항을 연달아 등록할 때마다
# 그 시간을 물면 등록 로딩이 눈에 띄게 길어진다. 짧게 캐시해서 매번 두드리지 않는다.
_PROBE_TTL = 10.0
_probe_cache: dict[str, tuple[float, bool]] = {}


def _cached_probe(key: str, check) -> bool:
    now = time.monotonic()
    hit = _probe_cache.get(key)
    if hit and now - hit[0] < _PROBE_TTL:
        return hit[1]
    ok = check()
    _probe_cache[key] = (now, ok)
    return ok


def _llm_api_available() -> bool:
    return _cached_probe("llm-api", lambda: _reachable(LLM_API_BASE))


def _ollama_available() -> bool:
    def check() -> bool:
        try:
            with urllib.request.urlopen(f"{OLLAMA_URL}/api/tags", timeout=1.5) as res:
                return res.status == 200
        except Exception:
            return False

    return _cached_probe("ollama", check)


def _post_json(url: str, payload: dict, timeout: float, headers: dict | None = None) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **(headers or {})},
    )
    with urllib.request.urlopen(request, timeout=timeout) as res:
        return json.loads(res.read().decode("utf-8"))


def _user_msg(content: str, reason: str | None) -> str:
    user = f"요구사항: {content}"
    if reason:
        user += f"\n수정 사유: {reason}"
    return user


def _ask_llm(engine: str, content: str, reason: str | None) -> list[rules.Finding]:
    raw = _ask_llm_api(content, reason) if engine == "llm-api" else _ask_ollama(content, reason)
    return _to_findings(raw, content)


def _ask_llm_api(content: str, reason: str | None) -> str:
    """사내 LLM API 서비스(OpenAI 호환)에 Chat Completions 로 판정을 요청한다.

    OpenAI 라이브러리의 client.chat.completions.create(...) 와 같은 HTTP 요청을
    표준 라이브러리로 보낸다 — 폐쇄망에 openai 패키지를 반입하지 않으려고.
    """
    body = _post_json(
        f"{LLM_API_BASE}/chat/completions",
        {
            "model": LLM_API_MODEL,
            "messages": [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": _user_msg(content, reason)},
            ],
            "temperature": 0,
        },
        timeout=LLM_API_TIMEOUT,
        headers={"Authorization": f"Bearer {LLM_API_KEY}"},
    )
    return body["choices"][0]["message"]["content"]


def _ask_ollama(content: str, reason: str | None) -> str:
    body = _post_json(
        f"{OLLAMA_URL}/api/generate",
        {
            "model": OLLAMA_MODEL,
            "prompt": f"{_SYSTEM_PROMPT}\n\n{_user_msg(content, reason)}",
            "format": "json",
            "stream": False,
        },
        timeout=OLLAMA_TIMEOUT,
    )
    return body.get("response") or "{}"


def _to_findings(raw: str, content: str) -> list[rules.Finding]:
    """모델 응답 텍스트를 Finding 으로 바꾼다. 형식이 어긋난 항목은 조용히 버린다."""
    parsed = _parse_json(raw)
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


def _parse_json(text: str) -> dict:
    """모델이 앞뒤에 군더더기를 붙여도 첫 JSON 객체를 뽑아 파싱한다.

    Ollama 는 format=json 으로 강제할 수 있지만 사내 LLM API 에는 그런 옵션이 없어서,
    설명 문장이 섞여 오는 경우를 여기서 흡수한다.
    """
    try:
        parsed = json.loads(text)
    except Exception:
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end <= start:
            return {}
        try:
            parsed = json.loads(text[start:end + 1])
        except Exception:
            return {}
    return parsed if isinstance(parsed, dict) else {}


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
