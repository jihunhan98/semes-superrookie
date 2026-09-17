# Bitbucket Server 연결 테스트 도구

`docs/domain-knowledge-from-bitbucket.md`에서 검토한 "AI가 사내 Bitbucket Server 코드를
읽어 도메인 지식을 추출한다"는 아이디어를 실제 기능으로 만들기 전에, 이 사내망에서
Bitbucket Server REST API가 실제로 되는지(네트워크·토큰 권한)부터 확인하는 최소 테스트
도구입니다. 실제 기능이 아니라 테스트용 스크립트입니다.

## 실행 방법

```bash
cd tools/bitbucket-domain-knowledge-test
pip install flask requests
python server.py
```

브라우저에서 `http://localhost:5055` 접속.

- 이 코드는 **사내 폐쇄망 안에서** 실행해야 합니다 — `bit-stms.semes.com` 같은 내부
  주소는 이 저장소를 만든 클라우드 세션에서는 아예 접속이 안 돼서, 서버 자체는 직접
  실행해보지 못했습니다(연결 실패/401/404 에러 처리 로직은 로컬 가짜 서버로 확인했습니다).

## 화면에서 하는 것

1. Base URL / 프로젝트 키 / 레포 슬러그 / Personal Access Token 입력
2. **브랜치 목록 가져오기** — `GET /rest/api/1.0/projects/{key}/repos/{slug}/branches`
3. **루트 디렉터리 목록 보기** — `GET .../browse` (파일을 클릭하면 아래 경로 칸에 채워짐)
4. **파일 내용 가져오기** — `GET .../raw/{path}` — 실제 소스 텍스트가 그대로 나옵니다

## Personal Access Token 발급

Bitbucket Server 웹 UI → 우측 상단 프로필 → **Manage account** → **HTTP access tokens**
→ Create token. 이 레포에 대해 **읽기(Read)** 권한만 주면 됩니다.

## 흔한 오류

| 오류 | 원인 |
|---|---|
| 연결 실패(네트워크) | Base URL이 이 서버에서 안 열리는 주소이거나 포트가 막힘 |
| 401 Unauthorized | 토큰이 비었거나 만료/오타 |
| 403 Forbidden | 토큰은 유효하지만 이 레포 읽기 권한이 없음 |
| 404 Not Found | 프로젝트 키/레포 슬러그/파일 경로/브랜치 이름 중 하나가 틀림 |
