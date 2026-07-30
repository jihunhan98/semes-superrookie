# 스파이크 기록 — 요구사항 모호성 검출기 (2026-07-04)

DESIGN.md 8번(향후 진행 순서)의 1단계 "AI 모듈(A) 프로토타입"을 실제로 진행한 기록이다. 목적은 단 하나: **오픈소스 LLM + 프롬프트만으로 요구사항 문장의 모호성을 판정하는 방식이 실제로 통하는지**를, 정식 아키텍처(Oracle/Bitbucket/인증 등) 없이 최소 구성으로 확인하는 것.

## 결과 요약

- **성공.** 파인튜닝 없이 오픈소스 7B 모델 + 프롬프트만으로 모호함/명확함 이분 판정은 테스트한 5문장 전부 정확했다.
- 모호 **유형** 분류(정량 기준 부재 vs 시간·일정 모호 등)는 가끔 애매한 케이스가 있었다 — 프롬프트에 예시를 더 추가하면 개선될 사안.
- React → Spring Boot → FastAPI → Ollama 4단 구조를 실제로 엮어서 브라우저에서 끝까지 동작하는 것까지 확인했다.
- 이 모든 테스트는 **SEMES 워크스테이션이 아니라 로컬 개발 맥북(Apple M5, 16GB RAM)** 에서 진행했다. 실제 워크스테이션의 속도/자원은 별도로 재현해서 확인해야 한다 (오픈 이슈로 남아있음).

## 아키텍처 (스파이크 버전)

```
[React (Next.js) :3000]
        │ POST /api/analyze
[Spring Boot (:8080)] ── AnalyzeController: 받은 문장을 AI 서버로 그대로 전달
        │ POST /analyze
[FastAPI (:8001)] ── main.py: 프롬프트 구성 + Ollama 호출 + JSON 파싱
        │
[Ollama (:11434) — qwen2.5:7b-instruct]
```

정식 아키텍처(docs/architecture.svg)에서 Oracle DB, Bitbucket 연동, 인증을 뺀 최소 버전이다. DB 저장도, 이력 관리도 없다 — 문장 하나 넣으면 판정 하나 나오는 게 전부.

## 1단계 — Ollama 설치 및 모델 단독 테스트

```bash
brew install ollama
brew services start ollama          # localhost:11434 에서 백그라운드 상시 구동
ollama pull qwen2.5:7b-instruct      # 4.7GB, Alibaba Qwen2.5 7B instruct 튜닝 버전
```

Spring/FastAPI 없이 `curl`로 Ollama API만 먼저 두들겨서 모델이 쓸만한지부터 확인했다. 이 단계에서 이미 5개 샘플 문장으로 응답 품질을 검증(아래 "테스트 결과" 표와 동일).

## 2단계 — AI 서버 (`ai-model/`, Python/FastAPI)

```bash
mkdir -p ai-model && cd ai-model
python3 -m venv venv
source venv/bin/activate
pip install fastapi "uvicorn[standard]"
```

[`ai-model/main.py`](../ai-model/main.py)의 핵심 구조:

- `POST /analyze` — `{"sentence": "..."}`를 받아 시스템 프롬프트(모호 유형 7가지 분류 + few-shot 예시 2개)와 합쳐 Ollama `/api/generate`를 `format: json`으로 호출, 응답을 파싱해 `{"ambiguous": bool, "type": str|null, "reason": str|null}` 형태로 반환.
- 프롬프트에 쓴 모호 유형 taxonomy는 DESIGN.md 5.1.1과 동일 (정량 기준 부재 / 모호한 정도부사 / 주어·주체 불명확 / 조건 발생 시점 불명확 / 예외·경계 조건 누락 / 접속사 범위 모호 / 시간·일정 모호 / 해당없음).

실행:

```bash
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8001
```

## 3단계 — 백엔드 (`backend/`, Spring Boot)

Java/Maven이 없어서 먼저 설치:

```bash
brew install openjdk@21 maven node
```

Spring Initializr로 골격 생성 (Spring Boot는 4.1.0이 이 시점 기본 버전으로 잡혔다 — 참고: Spring Boot 호환 범위가 계속 바뀌므로 실제 사내 표준 버전은 별도 확인 필요):

```bash
curl -s "https://start.spring.io/starter.zip?type=maven-project&language=java&javaVersion=21&baseDir=backend&groupId=com.semes&artifactId=backend&name=backend&packageName=com.semes.backend&dependencies=web" -o backend.zip
unzip -q backend.zip -d . && rm backend.zip
```

직접 추가한 파일은 [`AnalyzeController.java`](../backend/src/main/java/com/semes/backend/AnalyzeController.java) 하나뿐 — `POST /api/analyze`로 받은 요청을 `RestClient`로 AI 서버(`localhost:8001`)에 그대로 전달하고 응답을 반환한다.

**겪은 문제와 해결:** 처음에는 FastAPI가 매번 `422 Unprocessable Content: Field required` 를 반환했다. FastAPI(uvicorn) 로그를 보니 `WARNING: Unsupported upgrade request.` 가 찍혀 있었는데, 원인은 Spring의 `RestClient` 기본 요청 팩토리(JDK `HttpClient`)가 HTTP/1.1 요청에도 `Upgrade: h2c` 헤더를 붙여 보내면서 uvicorn이 이를 웹소켓 업그레이드 시도로 오인, 요청 바디를 제대로 못 읽은 것이었다. `RestClient` 생성 시 `SimpleClientHttpRequestFactory`(순수 `HttpURLConnection` 기반, HTTP/1.1만 사용)로 교체해 해결했다.

실행 (devtools 미포함이라 코드 수정 시 수동 재시작 필요):

```bash
export JAVA_HOME="/opt/homebrew/opt/openjdk@21"
export PATH="$JAVA_HOME/bin:$PATH"
./mvnw spring-boot:run
```

## 4단계 — 프론트엔드 (`frontend/`, Next.js)

```bash
npx create-next-app@latest frontend --typescript --eslint --tailwind --app --no-src-dir --import-alias "@/*" --use-npm
```

기본 템플릿의 `app/page.tsx`를 교체 — 텍스트 입력창 + 버튼 + 결과 표시만 있는 단일 화면. `fetch`로 `http://localhost:8080/api/analyze`를 직접 호출한다 (별도 상태관리 라이브러리 없이 `useState`만 사용, DESIGN.md 9.2의 TanStack Query 등은 이 스파이크에는 적용하지 않음 — 최소 구현이 목적이었기 때문).

참고: 이 프로젝트의 Next.js는 16.2.10으로, `create-next-app`이 자동 생성한 `frontend/AGENTS.md`에 "이 버전은 학습 데이터와 다를 수 있으니 `node_modules/next/dist/docs/`를 먼저 확인하라"는 안내가 있어 실제로 공식 docs를 확인한 뒤 작성했다 (`"use client"` + `useState` 패턴은 동일하게 유효함을 확인).

실행:

```bash
npm run dev
```

## 5단계 — End-to-end 테스트 결과

Ollama API를 직접 호출한 1차 테스트와, 브라우저에서 전체 스택을 통해 확인한 2차 테스트 모두 같은 결과를 보였다.

| 입력 문장 | 결과 | 비고 |
|---|---|---|
| "장비는 충분한 내구성을 가져야 한다." | 모호 · 정량 기준 부재 | ✅ 정확 |
| "챔버 내부 온도는 25±2도로 유지되어야 한다." | 모호 아님 | ✅ 정확 |
| "이상 발생 시 관련 부서와 협의하여 신속히 조치한다." | 모호 · 접속사 범위 모호 | ⚠️ 모호함 판정은 맞으나, 실제로는 "주어 불명확"/"시간 모호"에 더 가까움 — 유형 분류 정확도 개선 필요 |
| "장비는 IEC 60204-1 규격을 만족해야 한다." | 모호 아님 | ✅ 정확 |
| "가능한 한 빠르게 웨이퍼를 이송해야 한다." | 모호 · 시간·일정 모호 | ✅ 그럴듯함 |
| "적절히 조정한다." (브라우저 테스트) | 모호 · 모호한 정도부사 | ✅ 정확 |

처리 속도: 이 맥북(M5, 16GB, Metal 가속)에서 문장당 0.8~5.2초.

## 폴더 구조

```
ai-model/
  main.py          # FastAPI AI 서버
  venv/            # (gitignore)
backend/
  src/main/java/com/semes/backend/
    BackendApplication.java   # Spring Initializr 기본 생성
    AnalyzeController.java    # 직접 작성
  pom.xml
frontend/
  app/
    page.tsx       # 직접 작성 (테스트 화면)
    layout.tsx     # create-next-app 기본 생성
```

## 재현 방법 (처음부터 다시 띄우기)

```bash
# 1. Ollama (한 번만 설치하면 이후엔 brew services로 상시 구동)
brew services start ollama

# 2. AI 서버
cd ai-model && source venv/bin/activate && uvicorn main:app --port 8001

# 3. 백엔드
cd backend && JAVA_HOME=/opt/homebrew/opt/openjdk@21 ./mvnw spring-boot:run

# 4. 프론트엔드
cd frontend && npm run dev
```

## 한계 / 이 스파이크에 없는 것

- Oracle DB 연동 없음 (저장/이력 없음, 요청마다 즉석 판정만)
- Bitbucket 연동, 인증/권한, 기능 명세서 추출(B), 이해관계자 합의 워크플로우(1번) 등 다른 기능 전부 미구현 — 오직 모호성 판정(A) 하나만
- Spring Boot devtools 미포함 (코드 수정 시 수동 재시작)
- 실제 폐쇄망 워크스테이션이 아닌 로컬 개발 맥북에서 테스트

## 다음 단계

- 실제 워크스테이션에서 동일한 방식(Ollama + 같은 프롬프트)으로 재현해 속도/자원 실측
- 모호 유형 분류 정확도 개선을 위해 프롬프트에 few-shot 예시 추가 (특히 위 표의 3번째 케이스 같은 복합 모호성)
- 이후 데이터 모델(Oracle 테이블) 설계 및 나머지 기능으로 확장
