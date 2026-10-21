# Jira 프로젝트 등록과 실제 이슈 화면 연결

프로젝트 설정에서 하나의 ReqOps 프로젝트에 Jira 프로젝트를 여러 개 등록한다. 개수 제한은 없다. 등록 정보는 Oracle에 저장되어 다른 PC와 프로젝트 구성원도 동일하게 사용한다. 소유자가 등록·수정·삭제하고 구성원은 조회와 이슈 생성을 할 수 있다.

이번 범위는 등록 정보 관리, AI 결과를 담은 실제 Jira 이슈 생성, 생성된 이슈 페이지 열기다. Jira 프로젝트 자체 생성, 상태 동기화, Jira 수정 내용의 ReqOps 역반영은 포함하지 않는다.

## 설치

기존 데이터베이스에서는 애플리케이션 계정으로 접속하고 `db/init.sql` 전체를 DBeaver의 SQL 스크립트 실행으로 실행한다. 이 파일은 일반 `CREATE TABLE` 문 2개만 포함한다. PL/SQL 블록, 동적 SQL, `/` 구분자, 다른 파일 불러오기는 없다. 기존 테이블을 다시 만들거나 데이터를 지우지 않는다.

이전에 실행해 이미 생성된 테이블은 해당 `CREATE TABLE` 문을 제외하고 아직 없는 테이블만 생성한다. 이 파일은 반복 실행 시 자동으로 기존 테이블을 건너뛰는 스크립트가 아니다.

아예 비어 있는 DB에 신규 설치할 때만 `db/baseline-init.sql`, V002/V004/V005, `db/init.sql` 순서로 적용한다. 기존 DB에 baseline을 다시 실행하지 않는다.

프로젝트 등록만 할 때는 Jira 인증이 없어도 된다. 실제 생성까지 사용하려면 실행 환경 또는 gitignore된 `backend/.env`에 다음 두 값을 설정하고 백엔드를 재시작한다. 실제 값과 토큰은 저장소에 커밋하지 않는다.

```dotenv
JIRA_BASE_URL=http://jira.example.com:18080
JIRA_API_TOKEN=<Jira Server/Data Center 개인 액세스 토큰>
```

Jira 기본 경로가 `/jira`라면 기본 주소에도 해당 경로를 넣는다. 주소는 등록한 주소와 일치해야 하며, 서버 토큰은 이 주소로만 전송된다. 브라우저의 SSO 로그인 세션을 ReqOps 서버 인증으로 대신 사용하지 않는다. PAT 발급이 막혀 있거나 사내 Jira 버전이 PAT를 지원하지 않는다면 Jira 관리자와 인증 방식을 확인해야 한다. Cloud 이메일/API 토큰 인증과 다른 Bearer PAT 방식이다. 이 환경에서는 사내 서버에 접속하거나 인증을 검증하지 않았다.

## 화면 흐름

1. 프로젝트 설정 → Jira 프로젝트 → 프로젝트 추가.
2. Jira 기본 주소, 프로젝트 키, 표시 이름을 저장한다. 키가 다른 프로젝트를 필요한 만큼 추가한다. 이슈 유형 ID는 등록할 때 생략할 수 있으며 실제 이슈 생성 전에는 설정해야 한다. Jira 숫자 ID를 임의로 추측해 사용하지 않는다.
3. 산출물 화면에서 대상 Jira 프로젝트를 선택한다.
4. `Jira 이슈 생성 후 열기`를 누르면 해당 개발 이슈와 산출물 4종을 설명에 담아 실제 이슈를 생성한다. 개발 이슈가 4개라면 4개의 Jira 이슈에 각각 산출물 4종이 들어간다. 화면 진입이나 프로젝트 등록만으로 Jira 이슈를 생성하지 않는다.
5. Jira가 반환한 이슈 번호를 ReqOps에 저장하고 `/browse/발급번호`를 새 탭으로 연다. 팝업이 차단돼도 목록에 나타난 이슈 링크를 직접 열 수 있다.
6. 같은 대상 프로젝트와 개발 이슈에 대해서는 연결한 이슈를 열며 다시 생성하거나 내용을 덮어쓰지 않는다. Jira에서 수정한 내용은 ReqOps 원본에 자동 반영되지 않는다. 다른 Jira 프로젝트를 선택하면 그 프로젝트에는 별도 이슈를 만들 수 있다.

실제 Jira 화면은 ReqOps의 편집창이나 iframe으로 흉내 내지 않는다. 회사 SSO 로그인이 필요하면 사용자가 실제 Jira 페이지에서 로그인한다. 일반적으로 Jira의 SAMEORIGIN/CSP 정책 때문에 외부 페이지 안의 iframe은 차단된다.

산출물의 필드를 설명으로 모아 전송하며 내용을 URL에 넣거나 길이를 임의로 자르지 않는다. 회사 Jira 전용 필드에 나누어 넣는 매핑은 아직 없다. 프로젝트의 별도 필수 필드 때문에 Jira가 거부하면 생성이 실패했다고 표시한다. 이 경우 실제 필드 ID와 필수값을 확인한 후 매핑을 추가해야 한다. Mermaid는 텍스트 원문으로 전달되며 Jira에서 다이어그램 이미지로 자동 렌더링하지 않는다.

## API와 중복 처리

- `GET/POST /api/projects/{projectId}/jira/targets`
- `PATCH/DELETE /api/projects/{projectId}/jira/targets/{id}`
- `GET /api/projects/{projectId}/jira/requirements/{requirementId}/links`
- `POST /api/projects/{projectId}/jira/requirements/{requirementId}/issues/{issueId}/open`

새 이슈 생성에는 Jira REST v2 `POST /rest/api/2/issue`를 사용한다. 브라우저에서 받은 설명을 그대로 보내지 않고 해당 ReqOps 요구사항에 속한 개발 이슈와 저장된 산출물로 본문을 만든다. 대상 프로젝트·요구사항·개발 이슈의 소속을 확인한다. 서버에는 리다이렉트 따라가기와 POST 자동 재시도가 없다.

대상 행 잠금과 `(target_id,dev_issue_id)` 고유 제약으로 정상 응답 이후 중복 클릭을 방지한다. 네트워크 타임아웃이나 Jira 생성 후 ReqOps DB 커밋 실패는 분산 트랜잭션으로 묶이지 않는다. 그런 경우 Jira에서 생성 여부를 먼저 확인해야 한다. Jira 이슈에는 `reqops` 및 `reqops-dev-{개발이슈 ID}` 라벨을 붙인다. 응답 불명확 오류에 자동 재시도하지 않는다.

연결된 이슈가 있는 Jira 등록 정보는 주소·프로젝트 키 변경과 삭제를 막아 기존 링크를 유지한다. 표시 이름과 이슈 유형 ID는 수정할 수 있다. 연결 이력이 남아 있는 개발 이슈는 외래 키로 보호된다. 기존 개발 이슈를 재분할할 때 현재 서비스는 해당 이슈를 RETIRED 상태로 보관하므로 연결 이력도 유지된다.

## 근거

- [Jira REST 이슈 생성](https://developer.atlassian.com/server/jira/platform/jira-rest-api-example-create-issue-7897248/)
- [Data Center 개인 액세스 토큰](https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html)
- [Jira 보안 헤더](https://support.atlassian.com/jira/kb/jira-security-headers-configuration/)
- [구형 입력 링크: Jira 9 이상 비활성화](https://confluence.atlassian.com/jirakb/how-to-create-issues-using-direct-html-links-in-jira-159474.html)

## 검증

프런트 production/standalone 빌드와 단위 테스트 6개, 백엔드 테스트 26개가 통과했다. 백엔드는 실행 환경의 Java 17에 맞춰 테스트 명령에서만 `-Djava.version=17 -Dmaven.compiler.release=17`을 지정했다. 저장소의 Java 21 설정은 변경하지 않았다. 새 Jira 테스트 9개에는 로컬 HTTP 서버를 통한 전체 한글 본문 전송, 리다이렉트 차단, 인증 누락, 대상 주소 제한, 권한·소속 검사, 기존 이슈 재사용이 포함된다.

브라우저에서는 API 응답을 대체하여 Jira 프로젝트 6개 추가, 새로고침, 수정, 소유자/구성원 UI, 대상 선택, 인증 오류, 실제 이슈 URL 열기, 모바일 레이아웃을 확인했다. 실제 사내 Jira와 Oracle에 대한 연결 검증은 수행하지 않았다.
