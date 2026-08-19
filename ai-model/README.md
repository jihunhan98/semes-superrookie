# ai-model — 요구사항 검토 AI 서버

요구사항 문장에서 **불명확한 표현**과 **기존 요구사항과의 상충**을 찾아내는 FastAPI 서버.
Spring Boot 백엔드가 요구사항 등록/수정 시 이 서버를 호출한다.

> 사용자 입력부터 검토 결과가 화면에 뜨기까지 전체 과정을 그림으로 정리한 것:
> [`docs/img/ai-flow-detail.svg`](../docs/img/ai-flow-detail.svg)

## 검출 방식 — 규칙 기반 + 사내 LLM

**규칙 기반 검출이 항상 먼저 실행된다.** 미리 정해둔 표현이 문장에 있으면 그 자리에서
바로 잡아낸다(치환 제안까지 나온다). 그 위에 **사내 LLM API**(GPT-OSS-120B, OpenAI 호환)를
한 번 더 호출해서, 규칙이 못 잡는 것까지 보충한다.

사내 LLM이 응답하지 못해도(주소 미설정·연결 실패·타임아웃) 요청 자체는 실패하지
않는다 — 규칙 기반 결과만 담아 `engine: "unavailable"`로 응답한다. 그래서 요구사항
등록은 사내 LLM 상태와 무관하게 항상 끝까지 진행된다. 폐쇄망이라 외부 AI API
(Claude/GPT 등)는 애초에 쓸 수 없고, 이 사내 서비스 하나만 쓴다.

> 사내 LLM API는 OpenAI 파이썬 라이브러리와 같은 규격이라, 아래 호출과 동등하다.
> 다만 폐쇄망에 `openai` 패키지를 반입하지 않으려고 표준 라이브러리로 직접 보낸다.
>
> ```python
> client = OpenAI(api_key=LLM_API_KEY, base_url=LLM_API_BASE)
> client.chat.completions.create(model=LLM_API_MODEL, messages=[...])
> ```

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
  "engine": "llm-api",   // llm-api(사내 LLM 응답함) | unavailable(사내 LLM 미응답, 규칙 결과만)
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

## 검출 유형

`정량 기준 부재` · `모호한 정도부사` · `주어·주체 불명확` · `조건 발생 시점 불명확`
· `예외·경계 조건 누락` · `접속사 범위 모호` · `시간·일정 모호` · `기존 요구사항과 상충`

앞의 7개는 문장 자체의 문제라 `draftContent`로 치환 제안이 가능하다.
마지막 `기존 요구사항과 상충`은 문장만 고쳐서 해결되지 않으므로 치환하지 않고
협의 대상으로만 표시한다.

## 파일

```
ai-model/
  main.py           # FastAPI 앱 — /analyze, /health, /types
  rules.py          # 규칙 기반 검출기 (항상 먼저 실행)
  requirements.txt
  .env.example      # 설정 템플릿 — .env 로 복사해서 채운다
  .env              # 사내 LLM 주소 등 — .gitignore 되어 커밋되지 않는다
```
