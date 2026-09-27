"""요구사항 검토 AI 서버 (FastAPI).

Spring Boot 백엔드가 요구사항 등록/수정 시 이 서버를 호출한다.

  1. 규칙 기반 검출(rules.py)을 먼저 항상 돌린다.
  2. 사내 LLM API(GPT-OSS-120B · OpenAI 호환 Chat Completions)를 호출해서
     규칙이 못 잡는 것까지 보충한다.

사내 LLM이 응답하지 못해도(주소 미설정·연결 실패·타임아웃) 요청 자체는 실패하지
않는다 — 규칙 기반 결과만 담아 engine="rule"로 응답한다. 그래서 요구사항 등록은
사내 LLM 상태와 무관하게 항상 끝까지 진행된다.

engine="unavailable"은 이 서버가 내려주는 값이 아니다. 이 서버 자체가 응답하지
못했을 때 백엔드가 채우는 값이다 — "규칙만 돌았다"(rule)와 "아무 검토도 못
했다"(unavailable)는 화면에서 다르게 보여야 하므로 섞지 않는다.

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

import artifacts
import rules
from config import Settings
from providers import GeminiProvider, InternalProvider, RuleProvider

log = logging.getLogger("ai-model")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def _load_dotenv() -> None:
    """ai-model/.env 를 읽어 환경 변수로 올린다 (.env 는 커밋되지 않는다).

    python-dotenv 를 쓰지 않는 이유: 폐쇄망에 반입할 패키지를 하나라도 줄이려고.
    이미 셸에 설정된 값이 우선이라, 실행할 때 준 값이 .env 에 덮이지 않는다.
    """
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()

# 사내 LLM API 서비스 (OpenAI 호환). OpenAI 파이썬 라이브러리와 같은 규격이라,
# 아래 호출은 이것과 동등하다.
#   client = OpenAI(api_key="...", base_url=LLM_API_BASE)
#   client.chat.completions.create(model=..., messages=[...])
# 폐쇄망 반출이 막혀 있어 외부 API는 못 쓰고, 이 사내 서비스만 쓴다.
#
# 사내 서버 주소는 소스에 두지 않는다 — 저장소가 사외로 나가도 사내망 정보가 같이
# 나가면 안 되므로. 커밋되지 않는 ai-model/.env 나 환경 변수로 넘긴다.
# 비어 있으면 LLM 호출 자체를 건너뛰고 규칙 기반 결과만 사용한다.
LLM_API_BASE = os.getenv("LLM_API_BASE", "").strip()
LLM_API_MODEL = os.getenv("LLM_API_MODEL", "gpt-4")  # 서버가 서빙하는 모델명에 맞춘다
LLM_API_KEY = os.getenv("LLM_API_KEY", "EMPTY")      # 사내 서비스는 인증 없이 EMPTY
LLM_API_TIMEOUT = float(os.getenv("LLM_API_TIMEOUT", "30"))
SETTINGS = Settings()
SETTINGS.validate()
PROVIDER = ({
    "rule": lambda: RuleProvider(),
    "internal": lambda: InternalProvider(SETTINGS.internal_base, SETTINGS.internal_model, SETTINGS.internal_key, SETTINGS.timeout),
    "gemini": lambda: GeminiProvider(SETTINGS.gemini_key, SETTINGS.gemini_model, SETTINGS.timeout),
}[SETTINGS.provider])()

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
    # llm-api(사내 LLM 응답 받음) | rule(LLM 미응답, 규칙 결과만) — 운영 중 확인용
    engine: str
    scope: str  # full | diff
    elapsedMs: int


class SplitRequest(BaseModel):
    content: str = Field(..., description="확정된 요구사항 본문")
    # 사람이 "AI에게 물어보기"에 적은 참고 사항 — 선택.
    reason: str | None = Field(None, description="분할 시 참고할 추가 지시")


class IssueOut(BaseModel):
    title: str
    # content 안에 그대로 등장하는 구절이어야 한다 — 화면이 원문에 형광펜을 칠하기 위함.
    quote: str


class SplitResponse(BaseModel):
    issues: list[IssueOut]
    engine: str
    elapsedMs: int


class ArtifactGenerateRequest(BaseModel):
    type: str = Field(..., description="voc | functional | nonfunctional | detail-design")
    issueTitle: str = ""
    issueQuote: str | None = None
    requirementContent: str = Field("", description="근거가 된 확정 요구사항 전문 — 도메인 맥락용")
    reason: str | None = Field(None, description="재생성 시 참고할 내용 — 선택")
    # 같은 프로젝트의 다른 요구사항 — req-1~4가 지금 다루는 req와 유기적으로 엮여
    # 있을 수 있어(같은 모듈·같은 판정 기준 등) 참고용으로 함께 받는다. /analyze의
    # 상충 검출용 existing과 같은 값을 그대로 재사용한다(백엔드에서).
    existing: list[ExistingRequirement] = Field(default_factory=list)


class ArtifactGenerateResponse(BaseModel):
    content: dict
    engine: str
    elapsedMs: int

class ArtifactBatchRequest(BaseModel):
    issueTitle: str
    issueQuote: str | None = None
    requirementContent: str
    requestedTypes: list[str] = Field(default_factory=lambda: ["VOC", "FUNCTIONAL", "NONFUNCTIONAL", "DETAIL_DESIGN"])

class ArtifactOutput(BaseModel):
    type: str
    status: str
    content: dict | None
    errors: list[str] = Field(default_factory=list)

class ArtifactBatchResponse(BaseModel):
    schemaVersion: int = 2
    issue: dict
    outputs: list[ArtifactOutput]
    engine: str


@app.get("/health")
def health() -> dict:
    """사내 LLM API 설정 여부 — 폐쇄망 배포 후 첫 확인용."""
    return {
        "status": "ok",
        "provider": PROVIDER.name,
        "providerConfigured": PROVIDER.enabled,
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

    # 규칙 검출은 위에서 이미 돌았다. 그래서 LLM 을 못 써도 "검토는 됐다"가 맞다 —
    # 여기서 unavailable 을 쓰면 화면에 "AI 미응답 N건" 같은 앞뒤 안 맞는 표시가 나온다.
    # unavailable 은 AI 서버 자체가 응답하지 못한 경우에만 백엔드가 채운다.
    engine = "rule"
    if PROVIDER.enabled:
        try:
            extra = _ask_llm_api(target, req.reason)
            findings = _merge(findings, extra)
            engine = PROVIDER.name
        except Exception as e:  # LLM 실패는 치명적이지 않다 — 규칙 결과로 계속 간다.
            log.warning("사내 LLM 호출 실패, 규칙 결과만 사용: %s", e)

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


@app.post("/split", response_model=SplitResponse)
def split(req: SplitRequest) -> SplitResponse:
    """확정 요구사항을 개발 이슈 후보 N개로 나눈다 — "이슈 나누기" 화면의 AI 초안.

    규칙 기반(문장 단위)을 항상 먼저 돌려 결과를 보장하고, 사내 LLM이 설정돼
    있으면 더 나은 분할로 교체를 시도한다. LLM이 만든 인용구가 원문에 없으면
    (환각) 그 결과 전체를 버리고 규칙 결과로 되돌아간다 — 이슈 몇 개만 반쪽으로
    섞이면 화면에서 원인을 찾기 더 어렵기 때문.
    """
    started = time.monotonic()

    content = req.content or ""
    rule_issues = rules.split_issues(content)
    engine = "rule"
    issues = rule_issues

    if PROVIDER.enabled:
        try:
            llm_issues = _ask_llm_split(content, req.reason)
            if llm_issues:
                issues = llm_issues
                engine = PROVIDER.name
        except Exception as e:
            log.warning("사내 LLM 분할 호출 실패, 규칙 결과만 사용: %s", e)

    elapsed = int((time.monotonic() - started) * 1000)
    log.info("split engine=%s issues=%d %dms", engine, len(issues), elapsed)

    return SplitResponse(
        issues=[IssueOut(**i.to_dict()) for i in issues],
        engine=engine,
        elapsedMs=elapsed,
    )


@app.post("/artifacts/generate", response_model=ArtifactGenerateResponse)
def generate_artifact(req: ArtifactGenerateRequest) -> ArtifactGenerateResponse:
    """산출물 4종(SWVOC·기능·비기능 요구사항·Detail Design) 초안 — 개발 이슈 1건당 1개.

    규칙 기반(artifacts.py)을 항상 먼저 만들어 결과를 보장하고, 사내 LLM이 설정돼
    있으면 더 나은 초안으로 교체를 시도한다. LLM 응답이 화면이 기대하는 필드를
    갖추지 못하면(형식이 어긋나거나 JSON이 아님) 그 결과를 버리고 규칙 결과로
    되돌아간다 — 반쪽짜리 산출물이 저장되는 것보다 낫다.
    """
    started = time.monotonic()

    title = req.issueTitle or ""
    quote = req.issueQuote or ""
    content = artifacts.generate_v2(req.type, title, quote, req.requirementContent)
    engine = "rule"

    if PROVIDER.enabled and req.type in _ARTIFACT_PROMPTS:
        try:
            llm_content = _ask_llm_artifact(
                req.type, title, quote, req.requirementContent, req.reason, req.existing)
            if artifacts.is_valid_v2_shape(req.type, llm_content):
                content = llm_content
                engine = PROVIDER.name
        except Exception as e:
            log.warning("사내 LLM 산출물 생성 실패, 규칙 결과만 사용: %s", e)

    elapsed = int((time.monotonic() - started) * 1000)
    log.info("artifacts.generate type=%s engine=%s %dms", req.type, engine, elapsed)

    return ArtifactGenerateResponse(content=content, engine=engine, elapsedMs=elapsed)

@app.post("/v2/artifacts/batch", response_model=ArtifactBatchResponse)
def generate_batch(req: ArtifactBatchRequest) -> ArtifactBatchResponse:
    allowed = {"VOC": "voc", "FUNCTIONAL": "functional", "NONFUNCTIONAL": "nonfunctional", "DETAIL_DESIGN": "detail-design"}
    outputs: list[ArtifactOutput] = []
    for requested in req.requestedTypes:
        if requested not in allowed:
            outputs.append(ArtifactOutput(type=requested, status="FAILED", content=None, errors=["UNSUPPORTED_TYPE"]))
            continue
        outputs.append(ArtifactOutput(type=requested, status="SUCCEEDED",
            content=artifacts.generate_v2(
                allowed[requested], req.issueTitle, req.issueQuote, req.requirementContent)))
    issue = {"title": req.issueTitle, "symptom": None, "improvementReq": req.issueQuote,
             "changeScope": None, "constraintsNote": None, "beforeState": None, "afterState": None}
    return ArtifactBatchResponse(issue=issue, outputs=outputs, engine=PROVIDER.name)


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


def _ask_llm_api(content: str, reason: str | None) -> list[rules.Finding]:
    """사내 LLM API 서비스(OpenAI 호환)에 Chat Completions 로 판정을 요청한다.

    OpenAI 라이브러리의 client.chat.completions.create(...) 와 같은 HTTP 요청을
    표준 라이브러리로 보낸다 — 폐쇄망에 openai 패키지를 반입하지 않으려고.
    """
    raw = PROVIDER.generate(_SYSTEM_PROMPT, _user_msg(content, reason))
    return _to_findings(raw, content)


_SPLIT_SYSTEM_PROMPT = """당신은 반도체 장비 소프트웨어(VCS/AMR) 요구사항을 개발 이슈(Jira 티켓)로
나누는 전문가다. 주어진 확정 요구사항 본문을 실제 구현 단위로 몇 개의 개발 이슈로
나눌지 판단하라.

규칙:
- 이슈 경계는 "서로 다른 기능·모듈로 나눠 개발할 수 있는 지점"을 기준으로 삼는다.
- 요구사항이 이미 하나의 작은 변경이면 이슈 1개로 둔다. 억지로 쪼개지 않는다.
- quote는 반드시 원문에 그대로 등장하는 연속된 구절이어야 한다 — 지어내지 않는다.
- title은 15자 내외로 간결하게.

반드시 아래 JSON 형식으로만 답한다.
{"issues":[{"title":"이슈 제목","quote":"원문 그대로의 해당 구절"}]}"""


def _ask_llm_split(content: str, reason: str | None) -> list[rules.IssueCandidate]:
    """사내 LLM API로 이슈 분할을 요청한다. 환각 구절은 걸러낸다."""
    user = f"요구사항: {content}"
    if reason:
        user += f"\n참고 지시: {reason}"

    raw = PROVIDER.generate(_SPLIT_SYSTEM_PROMPT, user)
    parsed = _parse_json(raw)

    out: list[rules.IssueCandidate] = []
    for item in parsed.get("issues") or []:
        title = (item.get("title") or "").strip()
        quote = (item.get("quote") or "").strip()
        if not title or not quote or quote not in content:
            continue  # 원문에 없는 구절은 환각으로 보고 버린다.
        out.append(rules.IssueCandidate(title, quote))
    return out


# ── 산출물 4종(SWVOC·기능·비기능 요구사항·Detail Design) 생성 프롬프트 ──────────
#
# DESIGN.md 1.1(배경)·5.3(진행상황)에 적어 둔 프로젝트 도메인 지식을 그대로
# 시스템 프롬프트에 넣는다 — 이 맥락 없이 산출물을 생성하면 모듈명·용어가
# 프로젝트와 무관하게 뭉뚱그려진 결과가 나오기 쉽다.
_ARTIFACT_DOMAIN_CONTEXT = """[출력 언어]
JSON의 키는 지정된 영문 그대로 두되, 모든 값(설명·역할·목적·내용 등)은 반드시 한국어 문장으로
쓴다. 영어 단어·문장을 섞어 쓰지 않는다 — 클래스명·서비스명처럼 코드 식별자로 쓰이는 고유명사만
예외로 영문을 허용한다.

[근거 정책]
확정 요구사항과 출처가 함께 전달된 프로젝트 지식에 있는 사실만 사용한다. 자료에 없는 모듈명,
수치, 정책, 클래스명은 추정하지 말고 null로 둔다. 다른 요구사항이 관련 있을 때만 용어를 맞춘다."""

_VOC_PROMPT = f"""당신은 반도체 장비 소프트웨어(VCS/AMR) 개발 이슈의 SWVOC(고객 요구사항 정리)를 작성하는 전문가다.
{_ARTIFACT_DOMAIN_CONTEXT}

주어진 개발 이슈(제목·구절)와 근거가 된 확정 요구사항 전문을 바탕으로 SWVOC를 작성하라.
반드시 아래 JSON 형식으로만 답한다.
{{"requester":null,"requestContent":"확정 본문·고객 취지에서 발췌한 요청사항",
"specialNotes":null,"legacyExtras":{{}}}}"""

_FUNCTIONAL_PROMPT = f"""당신은 반도체 장비 소프트웨어(VCS/AMR) 개발 이슈의 기능 요구사항 명세를 작성하는 전문가다.
{_ARTIFACT_DOMAIN_CONTEXT}

주어진 개발 이슈(제목·구절)와 근거가 된 확정 요구사항 전문을 바탕으로 기능 요구사항을 작성하라.
기본·변형·예외 동작을 각각 작성한다. 자료에 없는 조건이나 결과는 null로 두고 applicability를
"UNKNOWN"으로 표시하며 reason에 확인이 필요한 이유를 쓴다.
반드시 아래 JSON 형식으로만 답한다.
{{"overview":"기능 개요","constraintsNote":null,
"scenarios":[
{{"type":"BASIC","precondition":null,"scenario":"...","postcondition":null,"applicability":"UNKNOWN","reason":"..."}},
{{"type":"VARIANT","precondition":null,"scenario":null,"postcondition":null,"applicability":"UNKNOWN","reason":"..."}},
{{"type":"EXCEPTION","precondition":null,"scenario":null,"postcondition":null,"applicability":"UNKNOWN","reason":"..."}}],
"legacyExtras":{{}}}}"""

_NONFUNCTIONAL_PROMPT = f"""당신은 반도체 장비 소프트웨어(VCS/AMR) 개발 이슈의 비기능 요구사항
(성능·신뢰성·가용성 등 품질 속성) 명세를 작성하는 전문가다.
{_ARTIFACT_DOMAIN_CONTEXT}

기본·변형·예외 동작을 품질 속성 관점으로 작성한다. 근거에 성능 수치나 장애 정책이 없으면
절대 만들어내지 말고 null과 UNKNOWN으로 표시한다.
반드시 아래 JSON 형식으로만 답한다.
{{"overview":"비기능 개요","constraintsNote":null,
"scenarios":[
{{"type":"BASIC","precondition":null,"scenario":null,"postcondition":null,"applicability":"UNKNOWN","reason":"..."}},
{{"type":"VARIANT","precondition":null,"scenario":null,"postcondition":null,"applicability":"UNKNOWN","reason":"..."}},
{{"type":"EXCEPTION","precondition":null,"scenario":null,"postcondition":null,"applicability":"UNKNOWN","reason":"..."}}],
"legacyExtras":{{}}}}"""

_DETAIL_DESIGN_PROMPT = f"""당신은 반도체 장비 소프트웨어(VCS/AMR) 개발 이슈의 Detail Design(상세 설계)을 작성하는 전문가다.
{_ARTIFACT_DOMAIN_CONTEXT}

Class Diagram과 Sequence Diagram(변경 전 AS-IS · 변경 후 TO-BE)을 Mermaid 완성 코드로 설계하라.
기술 클래스명만 나열하지 말고 사용자가 이해할 수 있는 업무 개념과 업무 언어를 쓴다. 예를 들어
AMR 매칭 요구사항이라면 실제 근거에 있는 AMR 후보, 상태, SoC, 맵 경로, 선택 결과와 그 처리 순서를
표현한다. 업무요청/처리결과, Host/TargetService 같은 범용 자리표시자를 쓰지 않는다.
변경 전 흐름의 근거가 없으면 흐름을 추측하지 말고 sequenceDiagram 안에
"변경 전 처리 흐름은 제공된 자료에서 확인되지 않음"이라는 Note만 넣고 asIsApplicability를
"UNKNOWN"으로 둔다. Mermaid 코드의 개행은 JSON 문자열 규칙대로 \\n으로 쓴다.
반드시 아래 JSON 형식으로만 답한다.
{{"description":"요구사항 근거에 따른 설계 설명",
"classDiagram":"classDiagram\\n    class 업무개념 {{\\n      +근거속성\\n    }}",
"sequenceDiagramAsIs":"sequenceDiagram\\n    participant 검토자\\n    Note over 검토자: 변경 전 처리 흐름은 제공된 자료에서 확인되지 않음",
"sequenceDiagramToBe":"sequenceDiagram\\n    participant 요청자 as 업무 역할\\n    요청자->>처리자: 근거가 있는 업무 동작",
"asIsApplicability":"UNKNOWN","asIsReason":"변경 전 처리 흐름은 제공된 자료에서 확인되지 않음",
"legacyExtras":{{}}}}"""

_ARTIFACT_PROMPTS = {
    "voc": _VOC_PROMPT,
    "functional": _FUNCTIONAL_PROMPT,
    "nonfunctional": _NONFUNCTIONAL_PROMPT,
    "detail-design": _DETAIL_DESIGN_PROMPT,
}


def _ask_llm_artifact(type_: str, title: str, quote: str, requirement_content: str,
                      reason: str | None, existing: list[ExistingRequirement] | None = None) -> dict:
    """사내 LLM API로 산출물 1종의 초안을 요청한다."""
    user = f"개발 이슈 제목: {title}\n이 이슈가 커버하는 요구사항 구절: {quote}\n근거 요구사항 전문:\n{requirement_content}"
    if existing:
        lines = "\n".join(f"- {e.reqKey}: {e.content}" for e in existing)
        user += f"\n\n프로젝트 내 다른 요구사항(관련 있으면 용어·설계를 맞추고, 없으면 무시):\n{lines}"
    if reason:
        user += f"\n재생성 시 참고할 내용: {reason}"

    raw = PROVIDER.generate(_ARTIFACT_PROMPTS[type_], user)
    return _parse_json(raw)


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

    사내 LLM API 에는 응답 형식을 JSON으로 강제하는 옵션이 없어서, 설명 문장이
    섞여 오는 경우를 여기서 흡수한다.
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
