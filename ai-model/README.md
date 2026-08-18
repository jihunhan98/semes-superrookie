# ai-model — 요구사항 검토 AI 서버

요구사항 문장에서 **불명확한 표현**과 **기존 요구사항과의 상충**을 찾아내는 FastAPI 서버.
Spring Boot 백엔드가 요구사항 등록/수정 시 이 서버를 호출한다.

## 판정 경로 3갈래

폐쇄망은 반출이 막혀 있어 외부 AI API(Claude/GPT 등)를 쓸 수 없다. 쓸 수 있는 건
**사내 LLM API**와 **개발 PC의 로컬 Ollama** 둘뿐인데, 둘 다 언제든 안 떠 있을 수 있다.
그렇다고 요구사항 등록이 막히면 안 되므로 **규칙 기반이 항상 깔려 있고**, 그 위에
쓸 수 있는 LLM을 얹는다. 어느 경로든 응답 형태는 같아서 백엔드는 차이를 모른다.

| 우선순위 | `engine` | 무엇 | 규격 |
|---|---|---|---|
| 1 | `llm-api` | **사내 LLM API 서비스** (GPT-OSS-120B) | OpenAI 호환 `POST /v1/chat/completions` |
| 2 | `ollama` | 개발 PC 로컬 Ollama | `POST /api/generate` |
| 3 | `rule` | 규칙 기반 — 항상 동작 | (로컬 파이썬) |

매 요청 전에 위에서부터 도달 가능한지 확인하고, 안 되면 아래로 내려간다.
호출 중에 실패해도 규칙 결과로 응답한다 — 등록이 막히는 일은 없다.
지금 어느 경로가 잡혀 있는지는 `GET /health`의 `active`로 확인한다.

> 사내 LLM API는 OpenAI 파이썬 라이브러리와 같은 규격이라, 아래 호출과 동등하다.
> 다만 폐쇄망에 `openai` 패키지를 반입하지 않으려고 표준 라이브러리로 직접 보낸다.
>
> ```python
> client = OpenAI(api_key="EMPTY", base_url="http://INTERNAL-LLM-HOST:6100/v1")
> client.chat.completions.create(model=..., messages=[...])
> ```

## 실행

```bash
cd ai-model
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

사내망에 있으면 아무 설정 없이 사내 LLM API를 잡는다. 사내망 밖(집·외부 PC)이면
자동으로 규칙 기반으로 내려가므로, 그대로 개발해도 된다.

로컬 Ollama까지 쓰려면 먼저 띄운다 (없어도 서버는 정상 동작한다):

```bash
ollama serve
ollama pull qwen2.5:7b-instruct
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `LLM_BACKEND` | `auto` | `auto` / `llm-api` / `ollama` / `rule` — 엔진을 강제하고 싶을 때 |
| `LLM_API_BASE` | `http://INTERNAL-LLM-HOST:6100/v1` | **사내 LLM API** 주소 (`/v1`까지 포함) |
| `LLM_API_MODEL` | `gpt-4` | 사내 서버가 서빙하는 모델명 — 서버에 맞게 조정 |
| `LLM_API_KEY` | `EMPTY` | 사내 서비스는 인증이 없어 `EMPTY` |
| `LLM_API_TIMEOUT` | `30` | 사내 LLM 응답 대기 시간(초) |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama 주소 |
| `OLLAMA_MODEL` | `qwen2.5:7b-instruct` | 사용할 로컬 모델 |
| `OLLAMA_TIMEOUT` | `20` | Ollama 응답 대기 시간(초) |
| `ANALYZE_DELAY` | `0` | **인위적 지연(초)** — 등록 화면 로딩 UI 테스트용 |

`ANALYZE_DELAY=3` 으로 띄우면 등록 시 3초 로딩이 걸려서 프론트 로딩 화면을 확인할 수 있다.

> 사내 서버의 주소·모델명은 환경에 따라 바뀔 수 있다. 소스를 고치지 말고
> `LLM_API_BASE` / `LLM_API_MODEL`로 넘긴다.

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
  "engine": "llm-api",   // llm-api | ollama | rule
  "scope": "full",
  "elapsedMs": 3
}
```

LLM이 붙은 경우에도 **규칙 결과가 먼저**이고 LLM이 새로 찾은 것만 뒤에 덧붙는다.
LLM이 원문에 없는 구절(`targetSpan`)이나 정의되지 않은 유형을 만들어내면 버린다(환각 방지).

`draftContent`가 화면의 **"확정될 본문"에 그대로 채워지는 값**이다.
AI 검토 결과 카드는 읽기 전용이고, 사용자는 이 draft 텍스트를 직접 고쳐서 확정한다.

### `GET /health`

사내 LLM·Ollama 각각의 도달 여부와, **지금 요청이 오면 실제로 쓰일 엔진**(`active`)을 반환한다.
폐쇄망에 배포한 뒤 "사내 LLM이 실제로 잡혔는지" 확인하는 용도다.

```jsonc
{
  "status": "ok",
  "backend": "auto",
  "llmApi": { "reachable": true, "base": "http://INTERNAL-LLM-HOST:6100/v1", "model": "gpt-4" },
  "ollama": { "reachable": false, "model": "qwen2.5:7b-instruct" },
  "active": "llm-api"
}
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
  rules.py          # 규칙 기반 검출기 (기본 동작)
  requirements.txt
```
