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
import artifact_validation as validation
import artifact_review
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
    state: str | None = None
    version: str | None = None


class AnalyzeRequest(BaseModel):
    content: str = Field(..., description="검토할 요구사항 본문")
    # 변경 전 본문도 현재 본문 전체와 함께 문맥으로 검토한다.
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
    severity: str = "ADVISORY"
    proposals: list[dict] = Field(default_factory=list)
    interpretations: str = ""
    conflictQuote: str | None = None
    spanStart: int | None = None
    spanEnd: int | None = None


class AnalyzeResponse(BaseModel):
    findings: list[FindingOut]
    # 입력 본문 그대로. 수정안은 findings[].proposals로 반환한다.
    draftContent: str
    # llm-api(사내 LLM 응답 받음) | rule(LLM 미응답, 규칙 결과만) — 운영 중 확인용
    engine: str
    scope: str  # full | diff
    elapsedMs: int
    reviewStatus: str = "RULE_ONLY"
    reviewedCount: int = 0


class SplitRequest(BaseModel):
    content: str = Field(..., description="확정된 요구사항 본문")
    # 사람이 "AI에게 물어보기"에 적은 참고 사항 — 선택.
    reason: str | None = Field(None, description="분할 시 참고할 추가 지시")
    existing: list[ExistingRequirement] = Field(default_factory=list)


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

    reqKey: str = "TARGET"
    issueContent: dict = Field(default_factory=dict)


class ArtifactGenerateResponse(BaseModel):
    content: dict
    engine: str
    elapsedMs: int

class ArtifactBatchRequest(BaseModel):
    issueTitle: str
    issueQuote: str | None = None
    requirementContent: str
    requestedTypes: list[str] = Field(default_factory=lambda: ["VOC", "FUNCTIONAL", "NONFUNCTIONAL", "DETAIL_DESIGN"])
    reqKey: str = "TARGET"
    existing: list[ExistingRequirement] = Field(default_factory=list)
    issueContent: dict = Field(default_factory=dict)

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


class ReviewIssue(BaseModel):
    title: str
    quote: str | None = None
    content: dict = Field(default_factory=dict)
    artifacts: list[dict] = Field(default_factory=list)


class ReviewRequest(BaseModel):
    requirementContent: str
    existing: list[ExistingRequirement] = Field(default_factory=list)
    issues: list[ReviewIssue]


class ReviewResponse(BaseModel):
    approved: bool
    concerns: list[str]
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

    import review
    existing = [e.model_dump() for e in req.existing]
    findings = review.detect(req.content, existing)
    invalid = any(len(f.target_span) > 500 for f in findings)
    findings = [f for f in findings if len(f.target_span) <= 500]
    engine, status, reviewed = "rule", "RULE_ONLY", 0
    # Every batch contains the entire current document; no source is silently dropped.
    batches, batch, size = [], [], len(req.content)
    for row in existing:
        if batch and size + len(row["content"]) > 40000:
            batches.append(batch)
            batch, size = [], len(req.content)
        batch.append(row)
        size += len(row["content"])
    batches.append(batch)
    if PROVIDER.enabled:
        successes = 0
        for batch in batches:
            try:
                user = _user_msg(req.content, req.reason, [ExistingRequirement(**e) for e in batch])
                if req.baseContent:
                    user += "\n변경 전 본문 전체:\n" + req.baseContent
                raw = PROVIDER.generate(_SYSTEM_PROMPT, user)
                parsed = _parse_json(raw)
                if not isinstance(parsed.get("findings"), list):
                    raise ValueError("검토 결과 목록 누락")
                validated = review.model_findings(parsed, req.content, batch)
                for row in parsed["findings"]:
                    if not isinstance(row, dict) or not row.get("targetSpan") or row["targetSpan"] not in req.content:
                        invalid = True
                    elif not review.heading(row["targetSpan"]) and (
                        not row.get("interpretations") or len(row["targetSpan"]) > 500
                        or req.content.count(row["targetSpan"]) != 1
                        or row.get("findingType") not in rules.ALL_TYPES):
                        invalid = True
                findings.extend(validated)
                reviewed += len(batch)
                successes += 1
            except Exception:
                log.warning("요구사항 검토 배치 실패; 규칙 검토 결과를 유지합니다.")
        engine = PROVIDER.name if successes else "rule"
        status = "COMPLETE" if successes == len(batches) and not invalid else "PARTIAL"
    if invalid: status = "PARTIAL"
    return AnalyzeResponse(findings=[FindingOut(**f.to_dict()) for f in review.dedupe(findings)],
        draftContent=req.content, engine=engine, scope="full-context",
        elapsedMs=int((time.monotonic()-started)*1000), reviewStatus=status, reviewedCount=reviewed)


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
            llm_issues = _ask_llm_split(content, req.reason, req.existing)
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
    errors = []
    engine = "rule"

    if PROVIDER.enabled and req.type in _ARTIFACT_PROMPTS:
        try:
            llm_content = _ask_llm_artifact(
                req.type, title, quote, req.requirementContent, req.reason, req.existing, req.reqKey, req.issueContent)
            if not artifacts.is_valid_v2_shape(req.type, llm_content):
                raise ValueError("산출물 필수 필드가 누락되었습니다.")
            sources = {e.reqKey:e.content for e in req.existing}
            sources[req.reqKey] = req.requirementContent
            errors = validation.validate_evidence(llm_content, sources)
            errors += validation.numeric_concerns(llm_content, "\n".join(sources.values()))
            content = llm_content
            engine = PROVIDER.name
        except Exception as e:
            errors.append(str(e))
            log.warning("산출물 생성/검증 실패: %s", e)

    elapsed = int((time.monotonic() - started) * 1000)
    log.info("artifacts.generate type=%s engine=%s %dms", req.type, engine, elapsed)

    if engine == "rule": errors.append("AI 생성이 완료되지 않았습니다. 재검토가 필요합니다.")
    content.setdefault("legacyExtras", {})["quality"] = {"status":"NEEDS_REVIEW" if errors else "GROUNDED", "concerns":errors}
    return ArtifactGenerateResponse(content=content, engine=engine, elapsedMs=elapsed)

@app.post("/v2/artifacts/batch", response_model=ArtifactBatchResponse)
def generate_batch(req: ArtifactBatchRequest) -> ArtifactBatchResponse:
    allowed = {"VOC": "voc", "FUNCTIONAL": "functional", "NONFUNCTIONAL": "nonfunctional", "DETAIL_DESIGN": "detail-design"}
    outputs: list[ArtifactOutput] = []
    for requested in req.requestedTypes:
        if requested not in allowed:
            outputs.append(ArtifactOutput(type=requested, status="FAILED", content=None, errors=["UNSUPPORTED_TYPE"]))
            continue
        generated = generate_artifact(ArtifactGenerateRequest(type=allowed[requested],
            issueTitle=req.issueTitle, issueQuote=req.issueQuote, requirementContent=req.requirementContent,
            reqKey=req.reqKey, existing=req.existing, issueContent=req.issueContent))
        quality = generated.content.get("legacyExtras", {}).get("quality", {})
        outputs.append(ArtifactOutput(type=requested, status="SUCCEEDED" if quality.get("status")=="GROUNDED" else "FAILED",
            content=generated.content, errors=quality.get("concerns", [])))
    issue = {"title": req.issueTitle, "symptom": None, "improvementReq": req.issueQuote,
             "changeScope": None, "constraintsNote": None, "beforeState": None, "afterState": None}
    return ArtifactBatchResponse(issue=issue, outputs=outputs, engine=PROVIDER.name)


_REVIEW_PROMPT = """당신은 VCS/AMR 요구사항과 개발 이슈, 산출물을 전체 검토하는 전문가다.
대상 확정 요구사항과 프로젝트의 모든 다른 요구사항을 근거로 이슈와 산출물의 누락,
모순, 근거 없는 수치·정책, 이슈 간 불일치를 점검하라. 다른 요구사항은 맥락이다.
자료에 없는 사실을 지어내지 마라. JSON만 답하라:
{"approved":true,"concerns":[]}
문제가 있으면 approved=false와 구체적인 concerns 배열을 반환하라."""


@app.post("/review", response_model=ReviewResponse)
def review(req: ReviewRequest) -> ReviewResponse:
    if not PROVIDER.enabled:
        return ReviewResponse(approved=False, concerns=["LLM 제공자가 설정되지 않아 AI 검토를 할 수 없습니다."], engine="rule")
    try:
        user = "확정 요구사항 전문:\n" + req.requirementContent
        user += _all_requirements(req.existing)
        user += "\n\n검토할 개발 이슈와 산출물 전문(JSON):\n" + json.dumps(
            [issue.model_dump() for issue in req.issues], ensure_ascii=False)
        result = _parse_json(PROVIDER.generate(_REVIEW_PROMPT, user))
        if type(result.get("approved")) is not bool or not isinstance(result.get("concerns"), list):
            raise ValueError("검토 결과의 JSON 형식이 올바르지 않습니다.")
        concerns = [str(item) for item in result["concerns"]]
        return ReviewResponse(approved=result["approved"] and not concerns,
                              concerns=concerns, engine=PROVIDER.name)
    except Exception as exc:
        log.warning("AI 전체 검토 실패: %s", exc)
        return ReviewResponse(approved=False, concerns=["AI 전체 검토에 실패했습니다. 연결과 응답 형식을 확인하세요."], engine="unavailable")


# ── 내부 구현 ────────────────────────────────────────────────────

_SYSTEM_PROMPT = """당신은 요구사항의 구현 결과와 시험 결과가 달라질 실제 문제만 검토한다.
제목, 목차, 단순 나열의 '및', '등', 문체는 검출하지 않는다. 전체 본문, 용어 정의, 참조를 먼저 확인한다.
정의된 기준을 다시 누락으로 지적하지 않는다. 같은 대상·속성·조건·시점인지 확인해야 상충이다.
버전이 없는 초안은 공식 확정 기준이 아니다. 버전이 있으면 전달된 본문은 마지막 확정본이며 수정 중 상태여도 기존 확정 기준으로 비교한다. 현재 본문과 기존 요구사항을 모두 읽고 변경 전후와 삭제도 검토한다.
숫자·주체·업무 정책을 만들어 확정하지 않는다. 근거 없는 값은 ⟦항목명: 입력 필요⟧로 표시한다.
제안은 설명이 아니라 그대로 넣을 문장이다. 교체/앞뒤 삽입/삭제를 구분하고 대안은 따로 제시한다.
문제마다 서로 다른 해석과 결과 차이를 interpretations에 구체적으로 쓴다.
JSON만 반환한다. 문제 없으면 {"findings":[]}.
{"findings":[{"findingType":"정량 기준 부재|모호한 정도부사|주어·주체 불명확|조건 발생 시점 불명확|예외·경계 조건 누락|접속사 범위 모호|시간·일정 모호|기존 요구사항과 상충|참조 요구사항 확인 필요",
"targetSpan":"현재 본문의 유일한 완전한 문장 또는 절 원문","reason":"실제 문제와 근거","suggestion":"선택 안내",
"interpretations":"구체적인 해석과 결과 차이","conflictReqKey":null,"conflictQuote":null,"sameCondition":null,
"proposals":[{"label":"제안 적용","operation":"REPLACE|INSERT_BEFORE|INSERT_AFTER|DELETE","after":"수정된 본문"}]}]}
상충이면 conflictReqKey와 conflictQuote에 기존 요구사항 ID와 정확한 인용, sameCondition에 동일 조건 근거를 명시한다.
"""


def _post_json(url: str, payload: dict, timeout: float, headers: dict | None = None) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **(headers or {})},
    )
    with urllib.request.urlopen(request, timeout=timeout) as res:
        return json.loads(res.read().decode("utf-8"))


def _all_requirements(existing: list[ExistingRequirement] | None) -> str:
    rows = existing or []
    return "\n\n같은 프로젝트의 다른 요구사항 전문(모두 검토하고 관련성·상충 여부를 판단):\n" + (
        "\n".join(f"- {e.reqKey} (상태={e.state or '미상'}, 버전={e.version or '없음'}): {e.content}" for e in rows) if rows else "(없음)")


def _user_msg(content: str, reason: str | None, existing: list[ExistingRequirement] | None = None) -> str:
    user = f"요구사항: {content}"
    if reason:
        user += f"\n수정 사유: {reason}"
    return user + _all_requirements(existing)


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


def _ask_llm_split(content: str, reason: str | None,
                   existing: list[ExistingRequirement] | None = None) -> list[rules.IssueCandidate]:
    """사내 LLM API로 이슈 분할을 요청한다. 환각 구절은 걸러낸다."""
    user = f"요구사항: {content}"
    if reason:
        user += f"\n참고 지시: {reason}"

    raw = PROVIDER.generate(_SPLIT_SYSTEM_PROMPT, user + _all_requirements(existing))
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
요구사항에 명시된 동작·역할·데이터를 바탕으로 개념 설계안을 작성한다.
실제 구현 클래스·메서드가 제공되지 않았으므로 description에 "개념 설계 제안"임을 명시한다.
이름을 제안할 수 있지만 기존 구현에서 확인된 클래스나 호출 관계라고 표현하지 않는다.
변경 후 흐름은 요구사항에 근거한 제안이며, 수치와 정책을 임의로 추가하지 않는다.
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
                      reason: str | None, existing: list[ExistingRequirement] | None = None,
                      req_key: str = "TARGET", issue_content: dict | None = None) -> dict:
    """사내 LLM API로 산출물 1종의 초안을 요청한다."""
    user = f"개발 이슈 제목: {title}\n이 이슈가 커버하는 요구사항 구절: {quote}\n근거 요구사항 전문:\n{requirement_content}"
    user += _all_requirements(existing)
    if reason:
        user += f"\n재생성 시 참고할 내용: {reason}"

    user += "\n대상 요구사항 ID: " + req_key
    user += "\n개발 이슈 본문:\n" + validation.checked_context({"issueContent":issue_content or {}})
    validation.checked_context(user)
    evidence_rule = '\n모든 산출물에 evidence 배열을 추가하라: [{"field":"scenarios.0.scenario 또는 해당 JSON 필드 경로","reqKey":"실제 요구사항 ID","quote":"그 요구사항 원문 그대로"}]. 실제 이슈 본문의 범위와 제약을 반영하고 수치·단위·이상/초과/이하/미만을 유지한다. 누락된 예외·경계 조건은 확인 필요로 표시한다.'
    raw = PROVIDER.generate(_ARTIFACT_PROMPTS[type_] + evidence_rule, user)
    return _parse_json(raw)


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


artifact_review.provider = PROVIDER
artifact_review.parse_json = _parse_json
app.include_router(artifact_review.router)

class ArtifactValidationRequest(ArtifactGenerateRequest):
    content: dict

@app.post('/artifacts/validate')
def validate_artifact(req: ArtifactValidationRequest):
    content = json.loads(json.dumps(req.content))
    sources = {e.reqKey:e.content for e in req.existing}
    sources[req.reqKey] = req.requirementContent
    errors = []
    if not artifacts.is_valid_v2_shape(req.type, content): errors.append('산출물 필수 필드가 누락되었습니다.')
    errors += validation.validate_evidence(content, sources)
    errors += validation.numeric_concerns(content, '\n'.join(sources.values()))
    content.setdefault('legacyExtras',{})['quality']={'status':'NEEDS_REVIEW' if errors else 'GROUNDED','concerns':errors}
    return {'valid':not errors,'content':content,'concerns':errors}
