# 실제 Atlaskit HTML 미리보기

Atlassian이 배포한 React 컴포넌트로 개발 이슈와 산출물 읽기 화면을 구성합니다.
`../atlaskit-issue-preview.html`은 필요한 JS·CSS·디자인 토큰을 포함한 단일 파일이며,
다운로드 후 브라우저에서 직접 열 수 있습니다. CDN이나 Jira 서버 연결이 필요하지 않습니다.

## 다시 빌드하기

```sh
cd docs/atlaskit-preview
npm ci
npm run build
```

- `preview.jsx`: 실제 `@atlaskit/*` 컴포넌트, 설명용 데이터와 로컬 상호작용
- `preview.css`: 화면 배치와 업무 문서의 스타일. 공식 버튼·탭·표의 내부 스타일을 복제하지 않습니다.
- `diagrams.js`: 직접 작성한 설명용 SVG
- `build.cjs`: 공식 배포 CSS, 디자인 토큰, React 코드를 HTML에 포함하고 사용 패키지의 라이선스를 수집합니다.
- `THIRD_PARTY_NOTICES.txt`: 번들에 포함된 코드의 고지. HTML에도 같은 내용이 들어갑니다.

버튼, 탭, 표, 상태, 경로, 안내 메시지는 실제 Atlaskit 컴포넌트입니다.
Jira 이슈 상세 화면 전체나 사내 템플릿이 라이브러리로 제공되는 것은 아니므로,
페이지 배치와 문서 양식은 별도로 구성합니다. 데이터·다이어그램·분할 결과는 설명용입니다.
원문 보기, 문서 탭, 이슈 선택, 메모 편집과 상태 변경이 동작하며 변경은 새로고침 시 초기화됩니다.

현재 앱의 프롬프트나 API·저장 동작은 변경하지 않습니다.

공식 자료:

- https://atlassian.design/get-started/develop/atlassians
- https://atlassian.design/components
- https://aui.atlassian.com/aui/latest/docs/getting-started.html

React 18 앱에는 Atlaskit이 자연스럽게 맞습니다. AUI는 Jira Server 계열의 UI 라이브러리로 별도 선택지입니다.
사내 Jira의 버전과 템플릿은 이 미리보기에서 확인한 정보가 아닙니다.
