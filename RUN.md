# 실행 가이드 — 핵심 기능 1 (모호성 해결)

고객 요구사항 원문을 넣으면 **모호한 표현을 검출 → 해결(해석 확정) → 해결 전/후 비교**까지
하는 실제 애플리케이션이다. ([DESIGN.md](DESIGN.md) 2장 구현)

> 참고: `ambiguity-demo/`는 초기 시연용(throwaway) 데모다. **이 문서가 가리키는 실제 프로젝트는
> 최상위 `frontend/` + `backend/` + `ai-server/`** 이다.

## 구성 (3-tier)

```
[Next.js :3000]  ──REST──▶  [Spring Boot :8080]  ──REST(문장별)──▶  [FastAPI :8001]  ──▶  Ollama(qwen3:8b)
   frontend/                  backend/                                 ai-server/           └(없으면) mock 규칙
   입력·해결·전후비교          조항 분리·REQ-ID·취합                    문장 모호성 판정(findings)
```

- **frontend/** (Next.js + TypeScript + Tailwind): 입력(텍스트) → 분석 → 조항별 모호 지점 표시 →
  해결하기/넘어가기 → 해결 전·후 비교. 백엔드의 `/api/analyze` 하나만 호출한다.
- **backend/** (Spring Boot 4 · Java 21): 원문을 조항 단위로 나눠 `REQ-2026-NNN`을 부여하고,
  조항마다 AI 서버에 판정을 위임해 취합한다.
- **ai-server/** (FastAPI): 문장 하나를 받아 모호성 유형(7종)·근거·고쳐쓰기 예시를 JSON으로 낸다.
  Ollama(qwen3:8b)가 떠 있으면 실제 LLM, 없으면 규칙 기반 mock으로 폴백(개발/시연 항상 가능).

## 사전 준비 (한 번만)

| 대상 | 필요한 것 | 설치 |
|---|---|---|
| ai-server | Python 3.11+ | `cd ai-server && pip install -r requirements.txt` |
| frontend | Node 20+ | `cd frontend && npm install` |
| backend | JDK 21 | (Maven은 `mvnw` 래퍼가 자동) |
| (선택) AI | Ollama + qwen3:8b | `ollama pull qwen3:8b` — 없으면 mock |

> **사내 프록시(SSL 검사)로 npm/pip/Maven이 막히면**
> - npm: `npm config set strict-ssl false` 또는 `set NODE_OPTIONS=--use-system-ca`
> - pip: `pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org -r requirements.txt`
> - Maven: `~/.m2/settings.xml`에 사내 프록시 설정

## 실행

- **한 번에**: `run-dev.bat` 더블클릭 → 서버 3개가 각각 창으로 뜨고 브라우저가 자동 오픈.
- **개별 실행**:
  ```
  cd ai-server && python -m uvicorn app:app --port 8001
  cd backend   && mvnw.cmd spring-boot:run          (mac/linux: ./mvnw spring-boot:run)
  cd frontend  && npm run dev
  ```

- 프론트: http://localhost:3000
- AI 서버 문서(Swagger UI 유사): http://localhost:8001/docs

## AI 판정기 확인 (mock ↔ LLM)

- 화면 우상단 배지가 `mock 판정` 이면 Ollama가 꺼져 있는 것. `ollama serve` + 모델이 있으면
  `LLM 판정 (Qwen3-8B)` 로 바뀐다.
- `curl http://localhost:8001/health` → `{"mode":"ollama"|"mock"}`

## 아직 안 된 것 (다음 단계)

- **docx 업로드** — 화면에 탭만 있고 '준비중'. 텍스트 입력만 동작.
- **해결 이력 영구 저장(감사 추적)** — 현재 해결/전후비교는 화면(메모리) 상태.
  DESIGN 2.4의 이력 보관은 DB(Oracle) 연동 시 붙인다.
- **핵심 기능 2(기능 도출) · 3(DB 변경관리)** — 별도 단계.
