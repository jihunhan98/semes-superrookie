# ai-model — 요구사항 검토 AI 서버

요구사항 문장에서 **불명확한 표현**과 **기존 요구사항과의 상충**을 찾아내는 FastAPI 서버.
Spring Boot 백엔드가 요구사항 등록/수정 시 이 서버를 호출한다.

## 왜 규칙 + LLM 두 갈래인가

폐쇄망에서 LLM(Ollama)이 안 떠 있을 수 있고, 떠 있어도 응답이 실패할 수 있다.
그렇다고 요구사항 등록 자체가 막히면 안 되므로 **규칙 기반이 기본 동작**이고
LLM은 그 위에 얹는다. 어느 쪽이든 응답 형태는 같아서 백엔드는 차이를 모른다.

응답의 `engine` 필드로 어느 경로로 판정했는지 확인할 수 있다 (`rule` / `llm`).

## 실행

```bash
cd ai-model
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

LLM까지 쓰려면 Ollama를 먼저 띄운다 (없어도 서버는 정상 동작한다):

```bash
ollama serve
ollama pull qwen2.5:7b-instruct
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama 주소 |
| `OLLAMA_MODEL` | `qwen2.5:7b-instruct` | 사용할 모델 |
| `OLLAMA_TIMEOUT` | `20` | LLM 응답 대기 시간(초) |
| `ANALYZE_DELAY` | `0` | **인위적 지연(초)** — 등록 화면 로딩 UI 테스트용 |

`ANALYZE_DELAY=3` 으로 띄우면 등록 시 3초 로딩이 걸려서 프론트 로딩 화면을 확인할 수 있다.

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
  "engine": "rule",
  "scope": "full",
  "elapsedMs": 3
}
```

`draftContent`가 화면의 **"확정될 본문"에 그대로 채워지는 값**이다.
AI 검토 결과 카드는 읽기 전용이고, 사용자는 이 draft 텍스트를 직접 고쳐서 확정한다.

### `GET /health`
Ollama 연결 여부와 모델명을 함께 반환한다.

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
