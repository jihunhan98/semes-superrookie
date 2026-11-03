# Jira Data Center 10.3.21 기준 이슈·산출물 화면 예시

새로 만든 예시: [jira-10.3.21-issue-preview.html](jira-10.3.21-issue-preview.html)

HTML을 다운로드해서 브라우저로 열면 됩니다. GitHub의 파일 보기 화면은 HTML을 실행하지 않습니다. 회사 PC에서는 다운로드한 HTML을 더블클릭하거나 브라우저에서 파일을 열어주세요. npm 설치, 서버 실행, 외부 CDN 접속이 필요하지 않습니다.

## 버전 기준

| 구분 | 적용 내용 |
| --- | --- |
| 회사에서 알려준 제품 버전 | Jira Software Data Center **10.3.21** |
| 실제 사용한 공식 UI 라이브러리 | **@atlassian/aui 9.12.0** |
| 보조 라이브러리 | jQuery 3.7.1 |
| 포함한 리소스 | AUI CSS·JavaScript, jQuery, AUI 아이콘 WOFF 폰트 |
| 공식 컴포넌트 | 버튼, 탭, 표, 상태 배지, 메시지, 폼, Dropdown 2, Dialog 2, 아이콘 |
| 별도로 구성한 부분 | 이슈·프로젝트 레이아웃, 문서 양식, 예시 데이터, SVG, 화면 내 편집·댓글 |

Jira 10.3 계열의 AUI 9.12 안내를 근거로 AUI **9.12.0**을 고정했습니다. 회사 10.3.21에 실제 포함된 AUI의 세부 패치 버전을 확인한 것은 아닙니다. Jira 제품 버전과 AUI 라이브러리 버전은 서로 다른 번호입니다. 이 HTML은 실제 Jira 서버를 실행하거나 사내 Jira 화면을 임베딩한 파일이 아닙니다.

회사 플러그인, 테마, 커스텀 필드, 워크플로, 문서 템플릿은 버전 번호만으로 알 수 없습니다. 따라서 사내 양식과 완전히 일치한다고 표시하지 않았습니다. 기존 Atlaskit 예시와 분리한 새 파일이며, 기존 앱 소스·DB·서버 설정은 변경하지 않았습니다.

## 확인할 화면과 동작

- 개발 이슈: 현상, 개선 요구, 변경 범위, 제약 조건, 변경 전·후, 완료 조건, 원문 근거.
- 산출물 4종: SWVOC, 기능 요구사항, 비기능 요구사항, 상세 설계.
- 기능 요구사항의 기본·대안·예외 흐름과 검증 표.
- 상세 설계의 예시 클래스 책임 표와 오프라인 SVG 시퀀스.
- 공식 AUI 탭 전환, 상태 드롭다운, 편집 다이얼로그, 요구사항·버전 정보 다이얼로그.
- 제목·개선 요구 편집, 댓글 추가, 상태 변경 및 화면 안의 변경 이력.

편집 내용은 메모리에만 유지하며 새로 열면 초기화됩니다. Jira 등록·API 호출·서버 저장은 하지 않습니다. HTML 입력은 텍스트로 표시합니다.

모든 요구사항·인물·이슈 키·분할 이유·클래스 이름은 설명용입니다. 기존 구현 분석이나 실제 AI 응답이 아닙니다. SOC 30%와 거리 수치는 검증 표의 가정이며 고객 확정 기준이 아닙니다. 실제 임계값, 성능 수치, 무후보·완전 동률 처리는 미정으로 표시했습니다.

## 소스와 다시 만들기

- 소스: [jira-10.3.21-preview.template.html](jira-10.3.21-preview.template.html)
- 빌드: [build_jira_10_3_21_preview.py](build_jira_10_3_21_preview.py)
- 라이선스: [jira-10.3.21-preview-LICENSE.txt](jira-10.3.21-preview-LICENSE.txt)

```bash
python docs/build_jira_10_3_21_preview.py
```

재생성할 때만 고정 버전의 공식 배포 파일을 다운로드하며 SHA-256을 검증합니다. Python 표준 라이브러리만 사용합니다. 다운로드 캐시는 `--asset-dir`로 지정할 수 있습니다. 생성된 HTML을 보는 데에는 Python과 네트워크가 필요하지 않습니다. 배포 CSS의 폰트 URL만 데이터 URL로 바꾸고, source-map 참조를 제거합니다. 원본 UI 컴포넌트 동작은 AUI JavaScript를 사용합니다.

## 확인한 공식 자료

- [Jira Software 10.3.x release notes](https://confluence.atlassian.com/jirasoftware/jira-software-10-3-x-release-notes-1472790887.html)
- [Atlassian Developer Community의 Jira 10.3 / AUI 9.12 안내](https://community.developer.atlassian.com/t/lack-of-contrast-of-subtle-rows-in-aui-tables/91846)
- [Jira Front-end API: AUI components](https://developer.atlassian.com/server/jira/platform/jira-frontend-api/)
- [AUI 9.12: Tabs](https://aui.atlassian.com/aui/9.12/docs/tabs.html)
- [AUI 9.12: Dialog 2](https://aui.atlassian.com/aui/9.12/docs/dialog2.html)

## 검증

- 고정된 공식 배포 파일 5종의 SHA-256 검증 통과.
- 오프라인 리소스 검사 통과: 외부 script/link/img/iframe 로드 없음, AUI 폰트는 데이터 URL로 포함.
- HTML의 ID 중복·탭과 앵커 대상 누락 검사 통과.
- 포함된 JavaScript 3개(jQuery·AUI·화면 동작)의 `node --check` 구문 검사 통과.
- 생성 스크립트를 로컬 캐시로 다시 실행해 네트워크 없이 재생성 가능함을 확인.
- 이 작업 환경의 브라우저 실행·로컬 파일 열기 제한으로 **실제 렌더링과 클릭 동작은 확인하지 못했습니다.** 실제 브라우저에서의 화면·접근성 검증은 남아 있습니다.
