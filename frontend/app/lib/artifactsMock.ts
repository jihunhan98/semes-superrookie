/**
 * 산출물 도출(기능 2) — 이슈 화면 목업 데이터 + 산출물 4종 내용 타입.
 *
 * 산출물 4종(SWVOC·기능·비기능 요구사항·Detail Design)은 이제 `lib/api.ts`의
 * `getArtifact`/`regenerateArtifact`/`confirmArtifact`로 실제 AI가 도출·저장한다.
 * 이 파일에 남은 건 (1) 그 내용의 모양(Voc/Functional/NonFunctional/DetailDesign
 * Content — 백엔드 content_json과 1:1) 과 (2) 이슈 상세 화면의 3범주(요구사항
 * 접수·개발·변경점 설계) 본문 — 이건 아직 AI 도출 로직이 없어 화면(UI/UX)만
 * 먼저 구성해 둔 목업이다({@link mockIssueFor}).
 */

export type BehaviorRow = {
  type: "기본" | "예외";
  item: "선행조건" | "시나리오" | "후행조건";
  content: string;
};

export type ClassNode = {
  name: string;
  fields: string[];
  changed?: boolean;
};

export type SeqStep = {
  who: string;
  msg: string;
  changed?: boolean;
};

export type SubArtifact = {
  key: string;
  state: "검토 대기" | "확정";
};

export type VocArtifact = SubArtifact & {
  description: string;
  request: string;
  notes: string;
};

export type FunctionalArtifact = SubArtifact & {
  description: string;
  role: string;
  purpose: string;
  behaviors: BehaviorRow[];
};

export type NonFunctionalArtifact = FunctionalArtifact & {
  constraints: string;
};

export type DetailDesignArtifact = SubArtifact & {
  classDiagram: ClassNode[];
  sequenceBefore: SeqStep[];
  sequenceAfter: SeqStep[];
  description: string;
};

// ── 산출물 4종 content_json 모양 — key·state는 API 응답(ArtifactDetail)의
// 다른 필드로 따로 오므로 뺀다. AI 서버(ai-model/main.py)의 프롬프트가 만드는
// JSON과 1:1로 맞아야 한다.
export type VocContent = Omit<VocArtifact, "key" | "state">;
export type FunctionalContent = Omit<FunctionalArtifact, "key" | "state">;
export type NonFunctionalContent = Omit<NonFunctionalArtifact, "key" | "state">;
export type DetailDesignContent = Omit<DetailDesignArtifact, "key" | "state">;

/**
 * 이슈 화면에 보여줄 값 — 실제 이슈(key·title·quote)에 목업 산출물 내용을 입힌 것.
 * "이슈 나누기"는 실제 기능이지만, 이슈 본문 3범주는 아직 화면
 * 얼개(목업)만 있어 여기서 값을 채운다({@link mockIssueFor} 참고).
 */
export type MockIssue = {
  key: string;
  title: string;
  state: "검토 대기" | "진행 중" | "완료";
  assigneeName: string;
  module: string;
  reception: { phenomenonText: string; improvementRequest: string };
  development: { changeScopeText: string; constraints: string };
  changeDesign: { before: string; after: string };
  dueDate: string;
  createdAt: string;
  resolvedAt: string | null;
};

const FULL_ISSUE: MockIssue = {
  key: "ISSUE-01",
  title: "가용 AMR 매칭",
  state: "진행 중",
  assigneeName: "이수민",
  module: "jobassign",
  reception: {
    phenomenonText:
      "다른 매칭 관련 이슈들과 비슷한 패턴으로 볼 때, 현재는 거리 기준 단순 정렬만 하고 있고 별도 우선순위 판정 로직은 없을 것으로 보임.",
    improvementRequest:
      "Host의 태스크 할당 요청 시, 가용 상태(IDLE·SoC 충분·에러 없음)인 AMR 중에서 정해진 우선순위 기준(SoC 높은 순)으로 선택해달라는 요청.",
  },
  development: {
    changeScopeText:
      "jobassign 모듈의 매칭 서비스(JobAssignService)와 정렬 로직이 영향받을 것으로 보임 — 실제 손대는 파일·DB 범위는 코드 확인 후 확정 필요.",
    constraints:
      "매칭 응답 200ms 이내 · 동시 요청 시 우선순위 큐 순서 보장 · 가용 0대면 대기(PENDING) 반환.",
  },
  changeDesign: {
    before:
      "요청 수신 → 가용 AMR 필터 → 거리순 정렬 → 최상위 매칭 → 결과 회신. (다른 이슈의 AS-IS 패턴에서 추정)",
    after:
      "요청 수신 → 가용 AMR 필터 → 우선순위(SoC 높은 순) 정렬 → 최상위 매칭 → 결과 회신. (요구사항·제약 근거로 AI 초안 설계)",
  },
  dueDate: "2026-09-05",
  createdAt: "2026-08-21",
  resolvedAt: null,
};

/**
 * 실제로 확정된 이슈(요구사항 → "이슈 나누기"로 나눈 결과)에 목업 본문(3범주)을 입힌다.
 *
 * <p>key·title·개선요청사항(quote)만 실제 값이고, 이슈 본문 3범주(요구사항 접수·
 * 개발·변경점 설계)의 세부 내용은 아직 AI 도출 로직이 없어 고정된 예시로 채운다
 * — 산출물 4종과 달리 이 부분은 계속 "UI/UX만" 구성하기로 한 범위라서다.
 */
export function mockIssueFor(
  real: { issueKey: string; title: string; quote: string | null },
): MockIssue {
  return {
    ...FULL_ISSUE,
    key: real.issueKey,
    title: real.title,
    state: "검토 대기",
    dueDate: "2026-09-12",
    createdAt: "2026-08-21",
    resolvedAt: null,
    reception: {
      ...FULL_ISSUE.reception,
      // 이슈 나누기에서 이 이슈가 커버하기로 한 구절 — 실제 값이 있으면 그걸 쓴다.
      improvementRequest: real.quote?.trim() || FULL_ISSUE.reception.improvementRequest,
    },
  };
}

/**
 * Sequence Diagram 단계 목록(who·msg)을 Mermaid `sequenceDiagram` 코드로 바꾼다.
 *
 * <p>msg가 "대상: 설명" 형태(대상 이름에 공백 없음)면 who→대상 화살표로, 아니면
 * who 자신에 대한 note로 그린다 — 기존 화면이 msg를 그렇게 취급해 왔다(who →
 * msg 로만 붙여 읽던 방식과 동일한 해석).
 */
export function toMermaidSequence(steps: SeqStep[]): string {
  const participants: string[] = [];
  function ensure(name: string) {
    if (!participants.includes(name)) participants.push(name);
  }

  const lines = steps.map((s) => {
    ensure(s.who);
    const colonIdx = s.msg.indexOf(":");
    const target = colonIdx > 0 ? s.msg.slice(0, colonIdx).trim() : "";
    const isTarget = target.length > 0 && !target.includes(" ");

    if (isTarget) {
      ensure(target);
      const desc = s.msg.slice(colonIdx + 1).trim() + (s.changed ? " (변경)" : "");
      return `    ${s.who}->>${target}: ${desc}`;
    }
    return `    Note right of ${s.who}: ${s.msg}${s.changed ? " (변경)" : ""}`;
  });

  return ["sequenceDiagram", ...participants.map((p) => `    participant ${p}`), ...lines].join("\n");
}
