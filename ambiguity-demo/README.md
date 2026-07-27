# ambiguity-demo — 요구사항 모호성 해결 데모 (3-tier)

[DESIGN.md](../DESIGN.md) 핵심 기능 1(모호성 해결)을 **React → Spring Boot → FastAPI(AI)** 구조로 구현한 데모.
(기능 추가 없이 기존 데모를 이 3계층 구조로 재구성한 것)

```
[React :3000]  ──REST──▶  [Spring Boot :8080]  ──REST(AI 필요 시)──▶  [FastAPI(AI) :8001]  ──▶  Ollama(qwen3:8b)
   웹 UI                     백엔드 · 조항 분리·취합              모호성 판정(JSON)          └(없으면) mock
```

- **React** (`web/`): 요구사항 입력 → "분석" → Spring Boot `/api/analyze` 호출 → 결과 표시(검출·해결·전후비교)
- **Spring Boot** (`backend/`): 텍스트를 조항 단위로 분리 → 조항마다 FastAPI에 판정 위임 → 취합해 반환. **Swagger 포함**
- **FastAPI** (`ai-server/`): 문장 하나의 모호성을 판정. Ollama(qwen3:8b) 있으면 실제 판정, 없으면 규칙 mock

## 실행 (Windows)

`run.bat` 더블클릭 → 3개 서버가 각각 창으로 뜨고, 잠시 후 브라우저에서 `http://localhost:3000` 자동 오픈.

- **프론트**: http://localhost:3000
- **백엔드 Swagger**: http://localhost:8080/swagger-ui.html
- **AI 서버 문서**: http://localhost:8001/docs

## 세팅 (한 번만)

- **JDK 21** — Spring Boot 실행용 (`java -version` 확인)
- **Python** — FastAPI + 정적 서버용
- (선택) **Ollama + qwen3:8b** — 실제 LLM 판정. 없으면 mock으로 동작
- **Node/npm/Maven 불필요** — React 빌드본(`web/dist`) + Spring Boot 빌드본(`backend/app.jar`) 포함
  > pip가 사내 프록시 인증서로 막히면:
  > `pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org fastapi uvicorn`

## 코드 다시 빌드할 때 (선택)

- React: `cd web && npm install && npm run build`
- Spring Boot: `cd backend && mvn -DskipTests package` → `target/app.jar` 생성 (이후 `backend/app.jar`로 복사)

## 구조
```
ambiguity-demo/
├─ run.bat                       3개 서버 실행 + 브라우저 오픈
├─ web/                          React (Vite) — dist 빌드본 포함
├─ backend/                      Spring Boot (Java 21) — app.jar 빌드본 포함, Swagger
│  ├─ pom.xml
│  ├─ app.jar
│  └─ src/main/java/com/semes/reqauto/...
└─ ai-server/
   └─ app.py                     FastAPI — 문장 모호성 판정 (Ollama/mock)
```
