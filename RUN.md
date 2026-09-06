# 실행 가이드

스택: Next.js(프론트) → Spring Boot(Java 21, API) → Oracle. 요구사항 AI 검토는 별도 FastAPI 서버(`ai-model`)가 담당한다. 세션/토큰 없음 — 모든 API는 `userId`를 직접 넘긴다.

띄우는 순서는 **DB → AI 서버 → 백엔드 → 프론트**. AI 서버가 꺼져 있어도 요구사항 등록 자체는 성공한다(검출 0건 + `aiEngine: "unavailable"`).

## 0. 한 번에 실행 (Windows)

DB만 미리 띄워두면, 나머지 세 서버는 배치파일 하나로 실행된다.

```
run-all.bat      실행 — AI 서버 / 백엔드 / 프론트를 각각 새 창에 띄운다
stop-all.bat     종료 — 8001 / 8080 / 3000 포트를 물고 있는 프로세스를 정리한다
```

서버마다 **창이 따로 열린다** — 로그가 한 창에 섞이면 어느 쪽 에러인지 구분이 안 되기 때문.

**환경에 맞춰 알아서 고른다.** 하나가 준비 안 됐다고 전부 멈추지 않고, 띄울 수 있는 것만 띄운 뒤 못 띄운 건 이유와 함께 마지막에 모아서 알려준다.

| | 찾는 순서 | 없으면 |
|---|---|---|
| AI 서버 | `ai-model\.venv` → `ai-model\venv` | 건너뜀 (등록은 되고, 규칙 기반으로만 검토됨) |
| 백엔드 | `mvnw.cmd` → PATH의 `mvn` → `MAVEN_HOME`/`M2_HOME` → `backend\target\*.jar` | 건너뜀 — **IDE에서 `ReqopsApplication` 실행** |
| 프론트 | `frontend\node_modules`(개발 서버) → `frontend\dist\standalone`(빌드 산출물) | 건너뜀 |

- **Maven이 설치돼 있지 않아도 된다.** `backend/mvnw.cmd`(Maven Wrapper)가 저장소에 있어서, 첫 실행 때 Maven을 알아서 내려받아 쓴다. 사내 프록시에 막혀 내려받지 못하면 IDE에서 백엔드를 띄우고 배치는 AI·프론트만 담당하게 두면 된다.
- **`npm install`이 안 돼도 된다.** `frontend/dist/standalone`이 저장소에 커밋되어 있어서, Node만 있으면 빌드 없이 바로 돌아간다. 다만 이 산출물은 프론트 코드를 고칠 때마다 다시 빌드해서 커밋해야 반영된다.
- 백엔드는 기동에 20~40초 걸린다. `Started ReqopsApplication` 로그가 뜨면 준비 완료.
- 프론트가 뜨면 브라우저로 `http://localhost:3000/login`이 자동으로 열린다.

아래 1~4는 각각을 따로 띄우거나, 무슨 일이 일어나는지 확인할 때 참고한다.

## 1. DB (Oracle)

`db/init.sql`을 실행한다.

1. DBA(SYSTEM) 계정으로 접속 → 파일 상단 **스키마 생성** 부분 실행 (`REQOPS` 사용자 생성)
2. `REQOPS` 계정으로 접속 → **테이블 생성** 부분 실행 (`USERS`, `PROJECTS`, `MEMBERSHIPS`, `PROJECT_TOKENS`, `REQUIREMENTS`, `REQUIREMENT_FINDINGS`, `REQUIREMENT_AI_DRAFTS`)

> 접속 주소(호스트·포트·SID)·비밀번호는 환경에 맞게 `db/init.sql`과 `backend/src/main/resources/application.yml`에서 함께 수정.

## 2. AI 서버 (FastAPI · `ai-model`)

요구사항 문장에서 불명확·상충을 검출하는 서버. 백엔드가 요구사항 등록/재분석 때 호출한다.

```bash
cd ai-model
pip install -r requirements.txt
cp .env.example .env      # 사내 LLM 주소를 쓸 때만. 안 채워도 서버는 뜬다.
uvicorn main:app --port 8001
```

- 포트 `8001` (백엔드의 `app.ai.base-url`과 맞춰야 한다)
- 규칙 기반 검출이 항상 먼저 돌고, 그 위에 **사내 LLM API(GPT-OSS-120B)**를 한 번 더 호출해 보충한다. 사내 LLM이 응답하지 않아도(주소 미설정 포함) 규칙 결과만으로 그대로 개발할 수 있다.
- 사내 LLM 주소가 잡혔는지는 `curl http://localhost:8001/health`의 `llmApiConfigured`로 확인한다.
- **사내 서버 주소는 소스·문서에 두지 않는다** — 저장소가 사외로 나가도 사내망 정보는 남지 않도록. `ai-model/.env`(`.gitignore` 처리됨)에 `LLM_API_BASE` · `LLM_API_MODEL`을 넣는다. 실제 값은 팀 내부에서 받는다.
- 빠른 확인:
  ```bash
  curl -X POST http://localhost:8001/analyze \
    -H "Content-Type: application/json" \
    -d '{"content":"AMR 매칭 시 가용한 AMR 중 가장 가까운 AMR을 선택한다. 단, 배터리가 부족하면 제외하고 빠르게 재할당한다."}'
  ```
- 로딩 UI를 확인하려면 `ANALYZE_DELAY=3 uvicorn main:app --port 8001`처럼 응답을 일부러 늦출 수 있다.
- 자세한 내용은 `ai-model/README.md`.

## 3. 백엔드 (Spring Boot · Maven)

```bash
cd backend
mvnw.cmd spring-boot:run     # Windows — Maven 설치 불필요
./mvnw spring-boot:run       # Mac/Linux
mvn spring-boot:run          # Maven 이 이미 설치돼 있으면 이것도 된다
```

**Maven을 설치할 필요는 없다.** `mvnw`(Maven Wrapper)가 저장소에 들어 있어서, 첫 실행 때 지정된 버전(3.9.9)의 Maven을 `~/.m2/wrapper`로 내려받아 쓴다. 두 번째부터는 받아둔 걸 재사용하므로 빠르다.

> 사내 프록시에 막혀 래퍼가 Maven을 못 받으면 세 가지 대안이 있다.
> 1. **IDE에서 실행** — IntelliJ/STS는 내장 Maven을 쓰므로 그냥 `ReqopsApplication`을 실행하면 된다. 제일 확실하다.
> 2. **IDE의 Maven 패널에서 `package`를 한 번 실행** — `backend/target/*.jar`이 생기고, 그 뒤로는 `java -jar target\reqops-backend-0.0.1.jar`로 띄울 수 있다(`run-all.bat`도 이걸 자동으로 찾는다).
> 3. **Maven을 직접 설치**하고 `MAVEN_HOME` 환경변수를 설치 폴더로 지정 — PATH에 안 넣어도 `run-all.bat`이 찾는다.

> 라이브러리 자동 다운로드 자체가 막히면, `~/.m2/settings.xml`에 사내 저장소(미러)를 잡거나 미리 받아둔 `.m2`를 사용한다. (상세 절차는 아래 "폐쇄망 빌드" 참고)

- 포트 `8080`
- 엔드포인트: 인증(`POST /api/signup`, `POST /api/login`), 프로젝트(`/api/projects…`), 요구사항(`/api/projects/{projectId}/requirements…`)
- AI 서버 주소·타임아웃은 `application.yml`의 `app.ai.base-url` / `app.ai.timeout-ms`
- 빠른 확인:
  ```bash
  curl -X POST http://localhost:8080/api/signup \
    -H "Content-Type: application/json" \
    -d '{"empNo":"20213456","name":"한지훈","dept":"VCS 개발파트","password":"secret123"}'
  ```
- Postman: `postman/ReqOps.postman_collection.json`을 Postman에 임포트(File → Import)하면 인증·프로젝트·요구사항·AI 서버 요청이 성공/실패 케이스까지 바로 실행 가능한 상태로 들어있다. `baseUrl`(기본 `http://localhost:8080`)·`aiBaseUrl`(기본 `http://localhost:8001`) 변수만 필요하면 바꾼다.

## 4. 프론트 (Next.js)

```bash
cd frontend
npm install
npm run dev              # http://localhost:3000
```

- `/signup` 회원가입, `/login` 로그인, `/dashboard` 프로젝트 목록
- `/projects/{id}/requirements` 요구사항 목록 · `/projects/{id}/requirements/new` 등록 · `/projects/{id}/requirements/{reqId}` 상세(AI 검토 결과 + 확정될 본문)
- 백엔드 주소는 `NEXT_PUBLIC_BACKEND`(기본 `http://localhost:8080`)
- 빌드 산출물로 바로 띄우려면 `frontend/dist/standalone/run.sh`(윈도우는 `run.bat`) — `npm install` 없이 `node server.js`로 뜬다.

## 5. 폐쇄망(에어갭) 환경에서 백엔드 빌드하기

전제: **실제 빌드 서버(폐쇄망)는 인터넷이 안 되지만**, 의존성을 미리 받아둘 수 있는 **인터넷 되는 PC(또는 CI)는 별도로 존재**한다. 즉 "인터넷 PC에서 다운로드 → 폐쇄망으로 반입 → 오프라인 빌드" 흐름이다.

### 5-1. 인터넷 PC에서 의존성 내려받기

`~/.m2`를 그대로 복사하면 관계없는 아티팩트까지 섞여 나가므로, **비어 있는 전용 로컬 저장소 경로**를 지정해서 이 프로젝트에 실제로 필요한 것만 받는다.

```bash
cd backend
mvn -Dmaven.repo.local=./m2-offline clean package
```

주의할 점:

- `dependency:go-offline` 대신 **실제로 돌릴 goal을 그대로 실행**하는 게 안전하다. `go-offline`은 `<dependencies>`는 챙기지만 `spring-boot-maven-plugin`, `maven-compiler-plugin`, `maven-surefire-plugin` 같은 **플러그인 자체와 그 하위 의존성**을 놓치는 경우가 많다.
- 폐쇄망에서 쓸 goal이 여러 개면(예: `package`뿐 아니라 `test`, `spring-boot:run`도 쓴다면) 인터넷 PC에서도 **그 goal들을 전부 한 번씩 같은 `-Dmaven.repo.local`로 실행**해서 필요한 아티팩트를 전부 채워 넣는다.
- 폐쇄망 서버와 **JDK 메이저 버전(21)을 맞춘다** — 톰캣 등 일부 아티팩트가 JDK 버전별로 분기될 수 있다.

받은 저장소를 압축한다.

```bash
tar czf m2-offline.tar.gz m2-offline
```

### 5-2. 폐쇄망으로 반입

사내 반출입 절차(USB, 자료 전송 시스템 등)로 `m2-offline.tar.gz`를 폐쇄망 빌드 서버로 옮긴 뒤 압축을 푼다.

```bash
tar xzf m2-offline.tar.gz -C /opt/repo/
# /opt/repo/m2-offline 이 생성됨
```

(`backend/m2-offline/`은 이미 `.gitignore`에 있으니, 소스 트리 안의 `backend/m2-offline/`에 풀어도 커밋될 걱정은 없다.)

### 5-3. 폐쇄망에서 오프라인 빌드

로컬 저장소 위치를 지정하고 **`-o`(offline) 플래그**로 외부 저장소 접속 시도 자체를 막는다.

```bash
mvn -o -Dmaven.repo.local=/opt/repo/m2-offline clean package
```

반복 실행할 거면 매번 옵션을 주는 대신 `~/.m2/settings.xml`에 고정해도 된다.

```xml
<settings>
  <localRepository>/opt/repo/m2-offline</localRepository>
  <offline>true</offline>
</settings>
```

### 5-4. 검증

- 빌드가 `Could not resolve dependencies` / `Connection refused`로 실패하면 → 5-1에서 그 goal을 안 돌려서 빠뜨린 아티팩트가 있다는 뜻. 인터넷 PC에서 해당 goal을 다시 실행해 채운 뒤 재반입.
- 정상 빌드되면 `backend/target/*.jar` 산출물이 나온다. 실행은 `java -jar target/reqops-backend-0.0.1.jar`.

> 참고: 지금은 팀 단위 1회성 반입이라 이 방식이 제일 간단하지만, 반복적으로 여러 프로젝트를 폐쇄망에 올려야 한다면 Nexus/Artifactory 같은 사내 미러 저장소를 두고 `settings.xml`의 `<mirror>`로 붙이는 게 장기적으로 더 낫다.

## 현재 범위

- **기능 1 — 회원가입·로그인·프로젝트**: 구현 완료 (목록/생성/참여/설정·토큰 재발급)
- **기능 2 — 요구사항**: 목록 · 최초 등록 · 상세(AI 자동 검토, 재분석)까지 구현 완료
- **기능 2 — 이후 추가**: 확정본 수정(변경분만 AI 검토), 고객 합의 기록, 확정(v1.0.0)·버전 이력·비교, 프로젝트별 요구사항 항목 설정

명세: `docs/기능명세서.md` · `docs/API명세서.md` · `docs/테이블명세서.md`
화면: `docs/화면정의서.html`(기능 1) · `docs/screens/f2.html`(기능 2)
