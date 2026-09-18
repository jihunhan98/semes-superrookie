# Bitbucket 도메인 지식 인덱싱 테스트 도구

`docs/domain-knowledge-from-bitbucket.md`에서 검토한 "AI가 사내 Bitbucket Server 코드를
읽어 도메인 지식을 추출한다"는 아이디어를 실제 기능으로 만들기 전에, 그 문서 3번(대규모
코드베이스 대응)에서 설계한 **인덱싱 루프**를 실제로 돌려보는 테스트 도구입니다. 실제
기능이 아니라 테스트용 스크립트고, 결과는 DB가 아니라 이 프로세스 메모리에만 쌓입니다
(서버를 껐다 켜면 사라짐).

## 실행 방법

```bash
cd tools/bitbucket-domain-knowledge-test
pip install flask requests
LLM_API_BASE=http://<사내 LLM 주소>/v1 python server.py
```

브라우저에서 `http://localhost:5055` 접속.

- Bitbucket 호출과 사내 LLM 호출 둘 다 **사내 폐쇄망 안에서** 실행해야 합니다 —
  `bit-stms.semes.com`도 사내 LLM 엔드포인트도 이 저장소를 만든 클라우드 세션에서는
  아예 접속이 안 돼서, 서버 자체는 직접 실행해보지 못했습니다. 로컬 가짜 Bitbucket
  서버 + 가짜 LLM 서버로 전체 흐름(브랜치 조회 → 재귀 파일 탐색 → 큰 파일 청크
  분할·map-reduce → 화면 스트리밍 → 다이어그램 렌더링)을 확인했습니다.
- `LLM_API_BASE`/`LLM_API_MODEL`/`LLM_API_KEY`/`LLM_API_TIMEOUT`은 `ai-model` 서비스가
  이미 쓰고 있는 것과 같은 환경변수입니다 — 거기 설정한 값을 그대로 넣으면 됩니다
  (OpenAI 호환 `/chat/completions`, 사내 서비스는 보통 `LLM_API_KEY=EMPTY`).

## 화면에서 하는 것

1. **레포 URL** 한 칸에 `http://bit-stms.semes.com:17990/projects/{프로젝트키}/repos/{레포슬러그}`
   형식으로 붙여넣으면 프로젝트 키·레포 슬러그를 자동으로 읽어옵니다.
2. **Personal Access Token** 입력 후 **브랜치 가져오기** → 드롭다운에서 브랜치 선택.
3. 확장자·최대 파일 수를 정하고(기본: java/py/ts/tsx/js/jsx/xml/sql/yml/yaml, 25개)
   **인덱싱 시작** → 레포를 재귀적으로 훑어 파일들을 찾고, 파일마다 사내 LLM에
   "이 코드가 다루는 업무 개념·클래스 역할을 요약해줘"를 보내 결과(경로/청크 수/요약/태그)가
   표에 실시간으로 쌓입니다.
   - 파일이 한 번에 보낼 수 있는 글자 수(입력+출력 합계 약 3만자)보다 크면, 줄 단위로
     잘라 조각마다 짧게 요약(map)한 뒤 그 부분 요약들을 다시 합쳐(reduce) 파일 전체
     요약으로 정리합니다 — 화면 아래 "이 루프가 실제로 사내 LLM에 어떻게 보내는지"를
     펼치면 그 과정을 시퀀스 다이어그램으로 볼 수 있습니다.

## Personal Access Token 발급

Bitbucket Server 웹 UI → 우측 상단 프로필 → **Manage account** → **HTTP access tokens**
→ Create token. 이 레포에 대해 **읽기(Read)** 권한만 주면 됩니다.

## 흔한 오류

| 오류 | 원인 |
|---|---|
| 연결 실패(네트워크) | 레포 URL이 이 서버에서 안 열리는 주소이거나 포트가 막힘 |
| 401 Unauthorized | 토큰이 비었거나 만료/오타 |
| 403 Forbidden | 토큰은 유효하지만 이 레포 읽기 권한이 없음 |
| 404 Not Found | 프로젝트 키/레포 슬러그/파일 경로/브랜치 이름 중 하나가 틀림 |
| "LLM_API_BASE가 설정 안 됐습니다" | 서버 실행 전에 `LLM_API_BASE` 환경변수를 안 넣음 |
