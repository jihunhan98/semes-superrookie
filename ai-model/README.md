# ai-model — 요구사항 검토 AI 서버

요구사항 문장에서 **불명확한 표현**과 **기존 요구사항과의 상충**을 찾아내는 FastAPI 서버.
Spring Boot 백엔드가 요구사항 등록/수정 시 이 서버를 호출한다.

> 사용자 입력부터 검토 결과가 화면에 뜨기까지 전체 과정을 그림으로 정리한 것:
> [`docs/img/ai-flow-detail.svg`](../docs/img/ai-flow-detail.svg)

## 요구사항 본문 검토

`POST /analyze`는 현재 본문 전체, 변경 전 본문, 수정 사유와 같은 프로젝트의 다른 요구사항 전문을 검토한다. 문맥 검출은 `review.py`, LLM 지시는 `main.py:_SYSTEM_PROMPT`에 있다. 제목·단순 나열의 “및”은 검출하지 않는다.

수정 제안은 자동 반영하지 않는다. `draftContent`는 입력 본문 그대로이고, `findings[].proposals`가 적용 가능한 편집을 담는다. 각 제안은 REPLACE / INSERT_BEFORE / INSERT_AFTER / DELETE, 정확한 원문과 UTF-16 위치, 변경할 문장, 미입력 값 여부를 제공한다. 사용자 결정이 필요한 값은 `⟦항목: 입력 필요⟧`로 표시한다.

LLM에는 구현·시험 결과가 달라지는 해석, 양쪽 원문과 같은 조건이라는 근거, 실제 수정문을 요구한다. 원문에 없는 위치·요구사항 인용은 적용할 수 없고, 근거 없는 숫자는 수정 제안에서 제외한다. 기존 요구사항은 상태와 버전도 함께 전달하며 초안과 확정 기준을 구분한다. 문서가 많으면 현재 본문 전체를 매번 포함해 기존 요구사항을 나눠 빠짐없이 비교한다.

| reviewStatus | 의미 |
|---|---|
| COMPLETE | 모든 배치의 AI 응답을 받음 |
| RULE_ONLY | LLM 비활성화. 문맥 규칙 검토만 수행 |
| PARTIAL | 배치 실패 또는 검증할 수 없는 응답 존재 |
| FAILED | 백엔드가 AI 서버 응답을 받지 못함 |

AI 미응답·부분 실패는 검출 0건 성공과 구분한다. COMPLETE도 AI가 모든 문제를 발견했다는 보장은 아니며 사용자 검토가 필요하다. 설정·주소는 기존 값을 유지한다.

세부 동작은 [구현·사용 안내](../docs/requirement-review-implementation.md), 설계 기준은 [설계안](../docs/requirement-review-suggestions.md)에 정리했다.

## 실행

```bash
cd ai-model
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

사내 LLM API를 쓰려면 주소를 `.env`에 넣는다. **사내 서버 주소는 사내망 정보라
저장소에 두지 않는다** — `.env`는 `.gitignore`에 있어 커밋되지 않는다.

```bash
cp .env.example .env
# .env 를 열어 LLM_API_BASE / LLM_API_MODEL 을 채운다 (실제 값은 팀 내부에서 받는다)
```

주소를 안 채워도 서버는 정상 동작한다 — 규칙 기반 결과만으로 응답하므로
사내망 밖(집·외부 PC)에서도 그대로 개발할 수 있다.

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `LLM_API_BASE` | (없음) | **사내 LLM API** 주소 (`/v1`까지 포함). 비어 있으면 LLM 호출을 건너뛴다 |
| `LLM_API_MODEL` | `gpt-4` | 사내 서버가 서빙하는 모델명 — 서버에 맞게 조정 |
| `LLM_API_KEY` | `EMPTY` | 사내 서비스는 인증이 없어 `EMPTY` |
| `LLM_API_TIMEOUT` | `30` | 사내 LLM 응답 대기 시간(초) |
| `ANALYZE_DELAY` | `0` | **인위적 지연(초)** — 등록 화면 로딩 UI 테스트용 |

`ANALYZE_DELAY=3` 으로 띄우면 등록 시 3초 로딩이 걸려서 프론트 로딩 화면을 확인할 수 있다.

값은 `ai-model/.env`(커밋 안 됨)에 넣거나 실행할 때 환경 변수로 준다. 셸에 이미 설정된
값이 `.env`보다 우선한다. 소스에 사내 주소를 적지 않는다.

## API

### `POST /analyze`

```jsonc
// 요청 — 최초 확정(본문 전체 검토)
{
  "content": "AMR 매칭 시 가용한 AMR 중 가장 가까운 AMR을 선택한다.",
  "existing": [{ "reqKey": "req-ta-01", "content": "태스크는 요청 순으로 할당한다." }]
}

// 요청 — 확정본 수정(변경분만 검토)
{
  "content": "…최대 1건만 허용한다. 우선순위는 SoC 높은 순으로 정한다.",
  "baseContent": "…최대 1건만 허용한다.",
  "reason": "req-ta-01과 우선순위 기준이 달라 통일 요청",
  "existing": []
}
```

```jsonc
// 응답
{
  "findings": [
    {
      "findingType": "정량 기준 부재",
      "targetSpan": "가용한 AMR",
      "reason": "무엇을 '가용'으로 볼지 판정 기준이 없어 해석이 갈릴 수 있음",
      "suggestion": "가용한 AMR = IDLE 상태이며 SoC(배터리 잔량)가 최소값 이상인 AMR",
      "conflictReqKey": null
    }
  ],
  "draftContent": "AMR 매칭 시 IDLE 상태이며 SoC 최소값 이상인 AMR 중 …",
  "engine": "llm-api",   // llm-api(사내 LLM 응답) | rule(규칙 기반만 — LLM 미설정·실패)
  "scope": "full",
  "elapsedMs": 3
}
```

**규칙 결과가 먼저**이고 LLM이 새로 찾은 것만 뒤에 덧붙는다.
LLM이 원문에 없는 구절(`targetSpan`)이나 정의되지 않은 유형을 만들어내면 버린다(환각 방지).

`draftContent`가 화면의 **"확정될 본문"에 그대로 채워지는 값**이다.
AI 검토 결과 카드는 읽기 전용이고, 사용자는 이 draft 텍스트를 직접 고쳐서 확정한다.

### `GET /health`

사내 LLM API 주소가 설정되어 있는지를 반환한다. 폐쇄망에 배포한 뒤
"사내 LLM 주소가 제대로 들어갔는지" 빠르게 확인하는 용도다.

```jsonc
{ "status": "ok", "llmApiConfigured": true, "llmApiModel": "gpt-4" }
```

### `GET /types`
검출 유형 목록. 프론트 안내 문구의 유형 칩과 동일한 순서다.

## 검출 유형 — 5개

| 유형 | 포함하는 문제 |
|---|---|
| 수치·판단 기준 불명확 | 수치·단위·처리시간·전송주기·대기시간·횟수 누락, 적절히·충분히 등 판단 기준 불명확 |
| 수행 주체 불명확 | 누가 해당 동작을 수행하는지 불명확 |
| 동작 조건 불명확 | 발생·전환 조건 불명확, AND/OR 조건의 묶음 모호성 |
| 예외 처리 누락 | 실패·후보 없음·동률·경계 조건의 처리 누락 |
| 기존 요구사항과 상충 | 같은 대상·조건에 적용되는 값이나 동작의 불일치 |

“참조 요구사항 확인 필요”는 검출에서 제외한다. 참조 ID가 등록되어 있지 않다는 사실 자체를 검출하지 않는다. 기존 요구사항 전문을 읽고 내용의 상충을 비교하는 기능은 유지한다.

시간·일정은 별도 유형으로 표시하지 않는다. 예를 들어 “주기적으로 전송한다”에 주기가 없는 경우는 “수치·판단 기준 불명확”이다. 반면 “필요 시 전송한다”의 발생 조건이 없으면 “동작 조건 불명확”이다.

기존 유형 이름으로 저장된 결과는 API에서 현재 5개 유형으로 합쳐 표시한다. 제외된 참조 검출은 상세·목록 건수·확정 차단 조건에서 빠진다. 새 분석에서도 제외한다. 이 변경은 DB 변경과 프론트 재빌드가 필요 없으며 백엔드와 AI 서버를 새 소스로 다시 시작하면 된다.

프롬프트를 수정할 때는 `main.py:_SYSTEM_PROMPT`와 `rules.py:ALL_TYPES`의 현재 5개 이름을 유지한다. 이전 모델 응답의 7개 세부 이름도 호환 매핑하지만 참조 검출은 받지 않는다.

## 파일

```
ai-model/
  main.py           # FastAPI 앱 — /analyze, /health, /types
  rules.py          # 규칙 기반 검출기 (항상 먼저 실행)
  requirements.txt
  .env.example      # 설정 템플릿 — .env 로 복사해서 채운다
  .env              # 사내 LLM 주소 등 — .gitignore 되어 커밋되지 않는다
```

## 등록 질문·프로젝트 용어사전

`/analyze` 요청의 `glossary`는 `{id,name,definition,status}` 목록이다. 응답은 `terms`(name/definition/quote), `termStatus`와 각 finding의 `questionText`, `options`를 추가한다. `/clarify-answer`는 content/targetSpan/question/answer/proposals/glossary를 받아 `{replacement}`를 반환한다. 본문 전체 저장과 정확한 위치 교체는 백엔드가 담당한다. 선택 구절 불일치는 409, 요청 형식·규칙 답변 반영 불가는 422, 잘못된 AI 문장 출력은 502, 모델 연결 실패는 503, 시간 초과는 504로 구분한다. 사내 모델의 4xx 요청 거절은 502와 실제 upstreamStatus로 구분한다. 응답 detail에는 원인 코드와 안내를 제공한다.

`intake.py`가 중요 용어 추출·질문 구성·답변 반영을 담당한다. CONFIRMED만 확정 정책으로 참고하고 PENDING은 추정으로 전달한다. DISMISSED는 뜻을 제공하지 않고 재등록 방지 이름만 전달한다. [사용 흐름·제약·DB 적용](../docs/registration-questions-and-glossary.md).

용어 추출에는 `/analyze.projectContext`의 프로젝트 이름·설명을 사용한다. 핵심 도메인 개념만 선정하며 일반 IT 약어·UI 단어·개별 상태값은 제외한다. 모델은 중요도 HIGH·kind·domainReason을 함께 반환해야 하며 새 후보는 최대 5개다. [선별 기준과 AI 오류 진단](../docs/registration-questions-and-glossary.md).
