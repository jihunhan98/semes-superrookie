/**
 * 기능 3(산출물 도출) UI 목업용 정적 데이터.
 *
 * "이슈 나누기"(요구사항 → 개발 이슈 N건)는 실제 백엔드가 있다(`lib/api.ts`의
 * `DevIssue`). 하지만 이슈 하나당 붙는 산출물 4종(SWVOC·기능·비기능 요구사항·
 * Detail Design)은 아직 AI 도출 로직이 없어 — 화면(UI/UX)만 먼저 구성하기로
 * 했다 — 실제 이슈의 key·title·구절에 고정된 예시 내용을 입혀서 보여준다
 * ({@link mockIssueFor}).
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

/**
 * 이슈 화면에 보여줄 값 — 실제 이슈(key·title·quote)에 목업 산출물 내용을 입힌 것.
 * "이슈 나누기"는 실제 기능이지만, 이슈 본문 3범주와 산출물 4종은 아직 화면
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
  voc: VocArtifact;
  functional: FunctionalArtifact;
  nonFunctional: NonFunctionalArtifact;
  detailDesign: DetailDesignArtifact;
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
  voc: {
    key: "VOC-01",
    state: "검토 대기",
    description:
      "고객사가 확정 요구사항에서 밝힌 AMR 매칭 기준에 대한 원문 취지를 정리한 내용.",
    request:
      "\"가장 가까운\" AMR이 아니라 \"정해진 우선순위 기준(SoC 높은 순)\"으로 선택해달라 — 확정 본문 + 고객 합의 내용에서 발췌.",
    notes:
      "다른 요구사항과 판정 기준이 겹쳐 있어 같은 기준으로 통일해야 한다는 협의가 있었음 — 다른 이슈와 함께 검토 필요.",
  },
  functional: {
    key: "FUNC-01",
    state: "검토 대기",
    description: "Host의 할당 요청을 받아 조건에 맞는 AMR을 골라 매칭하는 흐름을 정의한다.",
    role: "Host의 태스크 할당 요청에 대해 조건을 만족하는 가용 AMR을 선별·매칭한다.",
    purpose: "할당 지연·오배정을 방지하고 우선순위에 따라 최적의 AMR을 배정한다.",
    behaviors: [
      { type: "기본", item: "선행조건", content: "가용 AMR ≥ 1대, 요청이 스키마에 맞게 유효함" },
      { type: "기본", item: "시나리오", content: "요청 수신 → 가용 필터(IDLE·SoC 충분·에러 없음) → 우선순위 정렬 → 최상위 매칭 → 결과 회신" },
      { type: "기본", item: "후행조건", content: "매칭된 AMR 1대의 상태가 BUSY로 전환되고, 요청자에게 매칭 결과가 회신됨" },
      { type: "예외", item: "선행조건", content: "가용 필터를 통과한 AMR이 0대이거나, 요청 필수 필드가 누락됨" },
      { type: "예외", item: "시나리오", content: "가용 0대 → 대기(PENDING) 등록 후 가용 변화 이벤트 구독 / 필드 누락 → 즉시 거절" },
      { type: "예외", item: "후행조건", content: "가용 0대 시 PENDING 상태로 대기 등록됨 · 필드 누락 시 400 오류 코드로 회신됨" },
    ],
  },
  nonFunctional: {
    key: "NFUNC-01",
    state: "검토 대기",
    description: "가용 AMR 매칭 기능이 지켜야 할 성능·가용성 품질 속성.",
    role: "매칭 응답 속도와 동시 요청 처리 순서를 보장해 서비스 품질을 유지한다.",
    purpose: "Host 다건 요청이 몰려도 지연·역전 없이 안정적으로 매칭 결과를 회신한다.",
    behaviors: [
      { type: "기본", item: "선행조건", content: "초당 요청 수가 설계 한도(TPS) 이내" },
      { type: "기본", item: "시나리오", content: "요청 도착 순서대로 큐잉 → 매칭 처리 → 200ms 이내 회신" },
      { type: "기본", item: "후행조건", content: "모든 응답이 200ms 이내로 회신되고, 처리 순서가 도착 순서와 일치함" },
      { type: "예외", item: "선행조건", content: "순간 요청량이 설계 한도(TPS)를 초과함" },
      { type: "예외", item: "시나리오", content: "초과분은 큐에 대기 → 우선순위 규칙에 따라 순차 처리, 임계 초과 시 거절" },
      { type: "예외", item: "후행조건", content: "큐 대기 시간이 SLA(1초)를 넘기지 않고, 초과 거절분은 오류로 회신됨" },
    ],
    constraints:
      "매칭 응답 200ms 이내(P99) · 동시 요청 시 우선순위 큐 순서 보장 · 큐 대기 SLA 1초 초과 시 오류 회신.",
  },
  detailDesign: {
    key: "DD-01",
    state: "확정",
    classDiagram: [
      { name: "JobAssignService", fields: ["+ match(req): Result", "- sortByPriority()"] },
      { name: "AmrAvailabilityFilter", fields: ["+ filter(list): List", "+ isAvailable(amr): bool"], changed: true },
      { name: "PriorityQueue", fields: ["+ enqueue(amr)", "+ pop(): Amr"] },
    ],
    sequenceBefore: [
      { who: "Host", msg: "JobAssignService: 할당 요청" },
      { who: "JobAssignService", msg: "AmrAvailabilityFilter: 가용 목록 조회" },
      { who: "JobAssignService", msg: "거리순 정렬" },
      { who: "JobAssignService", msg: "Host: 매칭 결과 회신" },
    ],
    sequenceAfter: [
      { who: "Host", msg: "JobAssignService: 할당 요청" },
      { who: "JobAssignService", msg: "AmrAvailabilityFilter: 가용 목록 조회" },
      { who: "JobAssignService", msg: "PriorityQueue: SoC 우선순위로 정렬 요청", changed: true },
      { who: "PriorityQueue", msg: "동점 시 대기시간 최장 우선", changed: true },
      { who: "JobAssignService", msg: "Host: 매칭 결과 회신" },
    ],
    description:
      "기존에는 \"거리순\"으로 정렬했지만, 요구사항 확정에 따라 PriorityQueue를 거쳐 SoC(배터리 잔량) 높은 순으로 정렬하도록 변경한다. 동점 시 대기시간이 가장 긴 AMR을 우선한다.",
  },
};

/**
 * 실제로 확정된 이슈(요구사항 → "이슈 나누기"로 나눈 결과)에 목업 산출물 내용을 입힌다.
 *
 * <p>key·title·개선요청사항(quote)만 실제 값이고, 나머지 산출물 4종의 세부 내용은
 * 아직 AI 도출 로직이 없어 고정된 예시로 채운다 — 산출물은 "UI/UX만" 구성하기로
 * 한 범위라서다. seed는 화면에서 VOC-01/02… 처럼 이슈마다 다른 산출물 키를
 * 붙이는 데만 쓴다(1부터 시작).
 */
export function mockIssueFor(
  real: { issueKey: string; title: string; quote: string | null },
  seed: number,
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
    voc: { ...FULL_ISSUE.voc, key: `VOC-0${seed}` },
    functional: { ...FULL_ISSUE.functional, key: `FUNC-0${seed}` },
    nonFunctional: { ...FULL_ISSUE.nonFunctional, key: `NFUNC-0${seed}` },
    detailDesign: { ...FULL_ISSUE.detailDesign, key: `DD-0${seed}` },
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
