# Q&A

코드 관련 질문과 답변을 정리한 파일. 새 질문이 오면 이전 내용을 지우고 덮어쓴다.

---

## 1. `artifacts/[reqId]/split` 화면

### 1.1 나누는 기준 프롬프트를 어떻게 짜고 있나?

두 경로가 있다 — 사내 LLM이 설정돼 있으면 LLM에게, 아니면 규칙 기반으로.

**LLM 프롬프트** (`ai-model/main.py`의 `_SPLIT_SYSTEM_PROMPT`):

```
당신은 반도체 장비 소프트웨어(VCS/AMR) 요구사항을 개발 이슈(Jira 티켓)로
나누는 전문가다. 주어진 확정 요구사항 본문을 실제 구현 단위로 몇 개의 개발 이슈로
나눌지 판단하라.

규칙:
- 이슈 경계는 "서로 다른 기능·모듈로 나눠 개발할 수 있는 지점"을 기준으로 삼는다.
- 요구사항이 이미 하나의 작은 변경이면 이슈 1개로 둔다. 억지로 쪼개지 않는다.
- quote는 반드시 원문에 그대로 등장하는 연속된 구절이어야 한다 — 지어내지 않는다.
- title은 15자 내외로 간결하게.

반드시 아래 JSON 형식으로만 답한다.
{"issues":[{"title":"이슈 제목","quote":"원문 그대로의 해당 구절"}]}
```

여기에 화면의 "AI에게 물어보기" 입력값이 `참고 지시: {reason}` 한 줄로 유저 메시지에 덧붙어 간다. 응답 중 `quote`가 원문에 없는 문자열이면(환각) 그 항목은 통째로 버린다(`_ask_llm_split`).

**규칙 기반 폴백** (`ai-model/rules.py`의 `split_issues`): LLM이 설정 안 돼 있거나 실패하면, 문장 끝(`.`, `!`, `?`, "~다/~음/~됨/~함" 뒤 공백) 기준 정규식(`_SENTENCE_END`)으로 그냥 문장 단위로 자른다. 프롬프트라기보다 "화면이 빈 화면으로 뜨지 않게 하는 최소한의 초안" — 정교한 판단은 없다.

호출 순서(`AiClient.splitIssues` → `POST /split`): 규칙 기반을 먼저 돌려 기본값을 만들고, LLM이 있으면 시도해서 성공하면 그걸로 **통째로 교체**한다(둘을 섞지 않음).

### 1.2 나누기(split)할 때 "기능 (1)/기능 (2)"는 괜찮은데, 확정할 때는 내용에 맞는 제목을 지어줬으면

**지금 동작**: "✂ 나누기" 버튼은 프론트(`split/page.tsx`의 `splitAtMiddle`)에서 텍스트를 공백 기준으로 반씩 자르고, 제목은 그냥 원래 제목 뒤에 `(1)`/`(2)`를 붙이기만 한다 — AI 호출이 없다.

```ts
const left: Candidate = { clientId: newClientId(), title: `${target.title} (1)`, quote: a };
const right: Candidate = { clientId: newClientId(), title: `${target.title} (2)`, quote: b };
```

"이대로 확정" 버튼(`onConfirm` → `confirmIssueSplit` → 백엔드 `DevIssueService.confirmSplit`)도 마찬가지로 화면에 적힌 제목을 그대로 저장할 뿐, 확정 시점에 AI를 다시 불러 제목을 새로 짓는 로직은 없다.

```java
devIssueRepository.save(new DevIssue(
        requirementId, reqKey + "-" + (i + 1),
        in.title().trim(),   // ← 사람이 화면에 적은 값을 그대로 저장
        blankToNull(in.quote()), i, req.userId()));
```

→ 요청하신 "확정할 때 구절 내용 보고 AI가 제목을 다시 지어주는 것"은 지금 없음. 개발 필요 항목으로 기록.

### 1.3 상하가 아니라 좌우로(왼쪽 확정본 / 오른쪽 나뉜 이슈)

**지금 레이아웃**(`split/page.tsx`): "AI에게 물어보기" 카드 → "확정본" 카드 → 이슈 후보 카드 목록, 이렇게 세 블록이 전부 위아래로 쌓여있다(1단 세로 스택). 좌우 분할 뷰는 없음.

→ "확정본 | 나뉜 이슈"를 좌우로 놓아서 어떻게 나뉘었는지 한눈에 보이게 해달라는 요청으로 기록.

### 1.4 나눠진 구절 편집 시 "원문에서 위치를 찾지 못함" — 단순 문자열 비교인가?

맞다. `equals`는 아니고 **부분 문자열 탐색**(`indexOf`)이다 — `frontend/app/lib/highlight.ts`의 `locateSpans`:

```ts
const at = content.indexOf(span, from);
```

즉 카드에 적힌 `quote` 텍스트가 확정본 원문 안에 **글자 하나 안 틀리고 그대로** 들어있어야 형광펜이 붙는다. 사람이 그 칸(`<textarea className="quotein">`)을 직접 수정해서 원문과 조금이라도(띄어쓰기·어미 등) 달라지면 더 이상 못 찾고, `.nospan`("원문에서 위치를 찾지 못함") 배지가 뜬다 — 오타나 버그가 아니라 정확 일치 방식이라 생기는 당연한 결과다. 유사도 기반(fuzzy) 매칭 같은 건 없다.

→ "표현할 방법이 따로 없을까"에 대한 답: 지금은 없고, 구현한다면 이런 방향이 있을 수 있다(둘 다 미구현, 아이디어만).
- **처음 찾은 위치(offset)를 같이 저장**해두고, 텍스트가 편집돼도 그 좌표를 기준으로 표시하되 "원문과 달라짐" 배지만 붙이는 방식(위치는 유지, 내용 차이만 표시).
- **유사도 기반 매칭**으로 완전히 같지 않아도 가장 비슷한 구간을 찾아 근사 하이라이트하는 방식.

---

## 2. `artifacts/[reqId]` (개발 이슈 확정 후) 화면

### 2. 이슈 목록 UI가 단순 나열이라 별로다 — 다른 방법 없나?

**지금 구조**(`artifacts/[reqId]/page.tsx`의 `.arttree`): 이슈마다 제목 한 줄(`.irow`) 밑에 산출물 4종 링크 4줄(`.abranch` 안 `.arow`)이 딸려있는, 파일 트리/아코디언과 비슷한 순수 리스트다. 카드도, 열(column)도, 진행 상태 시각화도 없이 그냥 위아래로 쭉 나열.

→ "다른 방법"에 대한 답: 지금은 이 리스트 하나뿐이고 대안은 없다(예: 이슈별 카드 그리드, 칸반형, 산출물 4종을 가로 배지로 압축한 요약형 등) — 어떤 방향으로 바꿀지는 개발 단계에서 논의 필요.

### 2.1 "현상 기록"의 "AI가 알 수 없는 영역이라 빈칸입니다" 안내 — AI가 다 하게 해달라

**지금 근거**(`DESIGN.md` 4.2, AI 초안 vs 사람 판단 기준): "지금 받은 고객 요구서 + 정해진 문서 양식만으로 채울 수 있는가?"를 기준으로, 예이면 AI 초안, 아니오(현재 시스템 상태를 알아야 하거나 설계·예외 판단 필요)면 사람 몫으로 나눠 놨다. 그래서 이슈 상세 화면(`issues/[issueKey]/page.tsx`)의 〈요구사항 접수〉 현상 기록, 〈요구사항 개발〉 변경 범위, 〈변경점 설계〉 변경 전(As-Is) — 이 세 항목만 `.humanbox`/`.humantag`("🖊 사람 작성 필요")로 빈칸 처리돼 있다. 나머지(개선요청사항·제약사항·변경 후)는 `.aitag`("🤖 AI 도출")로 채워져 있다.

→ "이 세 항목도 AI가 초안을 채우게 해달라(검토는 사람이 하니까)"는 요청으로 기록.

### 2.2 "하위 작업"·"AI 도출"·"사람 보완 권장" 같은 라벨 다 없애고, 도출하자마자 바로 수정 가능한 UX로

**지금 상태**: 산출물 상세 화면들(`issues/[issueKey]/[artifactType]/page.tsx`)의 거의 모든 필드 옆에 `.aitag`("🤖 AI 도출")가 붙어있고, SWVOC의 "특이사항" 항목에는 `· 사람 보완 권장`이라는 문구가 추가로 붙는다. 이슈 상세 화면에는 "하위 작업 (산출물 4종)"이라는 섹션 제목도 있다. 화면 전체가 읽기 전용 카드(`wcard readonly`)로만 돼 있어 여기서 바로 고칠 수 있는 곳이 없다.

→ 요청 내용: 이런 배지·라벨·안내문 전부 없애고, "도출" 버튼을 누르면 곧바로 그 요구사항에 대한 내용을 자연스럽게 고칠 수 있는 화면(우리는 틀=양식만 제공, 내용은 전부 AI가 채운 걸 사람이 그 자리에서 수정)으로 바꿔달라는 것으로 기록.

### 2.3 산출물도 지금 AI한테 어떤 프롬프트로 도출하는지 정리

**결론부터: 지금 산출물(SWVOC·기능 요구사항·비기능 요구사항·Detail Design) 도출에는 AI 프롬프트가 전혀 없다.** 실제로 AI를 호출하는 건 위 1.1의 "이슈 나누기"(`/split`) 하나뿐이고, 그 이후 산출물 4종은 100% 고정된 예시 데이터다.

`frontend/app/lib/artifactsMock.ts`의 `FULL_ISSUE` 상수 하나(가용 AMR 매칭 예시 — SWVOC·기능·비기능·Detail Design 내용 전부 하드코딩)를 `mockIssueFor()`가 실제 이슈의 key·title·quote만 갈아끼워서 모든 이슈에 똑같이 복사해 보여준다:

```ts
export function mockIssueFor(real, seed) {
  return {
    ...FULL_ISSUE,              // ← SWVOC·기능·비기능·Detail Design 내용은 전부 이 고정값
    key: real.issueKey,
    title: real.title,
    reception: { ...FULL_ISSUE.reception, improvementRequest: real.quote?.trim() || ... },
    voc: { ...FULL_ISSUE.voc, key: `VOC-0${seed}` },        // 키 번호만 다르게
    functional: { ...FULL_ISSUE.functional, key: `FUNC-0${seed}` },
    nonFunctional: { ...FULL_ISSUE.nonFunctional, key: `NFUNC-0${seed}` },
    detailDesign: { ...FULL_ISSUE.detailDesign, key: `DD-0${seed}` },
  };
}
```

즉 이슈를 몇 개로 나누든, 각 이슈의 산출물 4종은 (구절이 반영되는 "개선요청사항" 한 줄 빼고는) 전부 같은 "가용 AMR 매칭" 예시 내용을 보여준다 — 이건 지난 대화에서 "산출물은 UI/UX만 구성해달라"고 하셔서 의도적으로 AI 연결을 안 해둔 상태다. 백엔드에도 산출물 4종을 생성하는 API/서비스 자체가 없다(`domain/issue`에는 이슈 분할만 있고, 산출물 엔티티·서비스는 없음).
