/**
 * 기능 3(산출물 도출) UI 목업용 정적 데이터.
 *
 * 아직 AI 도출 백엔드가 없다 — 화면 구성만 보기 위한 것이라, 어떤 요구사항을
 * 골라도 항상 같은 예시 이슈 3건을 보여준다. reqKey만 실제 값을 그대로 써서
 * "이 요구사항에서 나온 것"처럼 자연스럽게 이어 보이게 한다.
 */

export type WriterBadge = "ai" | "human";

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

export type DevIssue = {
  key: string;
  title: string;
  state: "검토 대기" | "진행 중" | "완료";
  assigneeName: string;
  module: string;
  reception: { phenomenon: WriterBadge; phenomenonText: string; improvementRequest: string };
  development: { changeScope: WriterBadge; changeScopeText: string; constraints: string };
  changeDesign: { before: string | null; after: string };
  dueDate: string;
  createdAt: string;
  resolvedAt: string | null;
  voc: VocArtifact;
  functional: FunctionalArtifact;
  nonFunctional: NonFunctionalArtifact;
  detailDesign: DetailDesignArtifact;
};

const FULL_ISSUE: DevIssue = {
  key: "ISSUE-01",
  title: "가용 AMR 매칭",
  state: "진행 중",
  assigneeName: "이수민",
  module: "jobassign",
  reception: {
    phenomenon: "human",
    phenomenonText: "",
    improvementRequest:
      "Host의 태스크 할당 요청 시, 가용 상태(IDLE·SoC 충분·에러 없음)인 AMR 중에서 정해진 우선순위 기준(SoC 높은 순)으로 선택해달라는 요청.",
  },
  development: {
    changeScope: "human",
    changeScopeText: "",
    constraints:
      "매칭 응답 200ms 이내 · 동시 요청 시 우선순위 큐 순서 보장 · 가용 0대면 대기(PENDING) 반환.",
  },
  changeDesign: {
    before: null,
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

function lightIssue(key: string, title: string, state: DevIssue["state"], seed: number): DevIssue {
  return {
    ...FULL_ISSUE,
    key,
    title,
    state,
    dueDate: "2026-09-12",
    createdAt: "2026-08-21",
    resolvedAt: state === "완료" ? "2026-08-24" : null,
    voc: { ...FULL_ISSUE.voc, key: `VOC-0${seed}` },
    functional: { ...FULL_ISSUE.functional, key: `FUNC-0${seed}`, state: state === "완료" ? "확정" : "검토 대기" },
    nonFunctional: { ...FULL_ISSUE.nonFunctional, key: `NFUNC-0${seed}`, state: state === "완료" ? "확정" : "검토 대기" },
    detailDesign: { ...FULL_ISSUE.detailDesign, key: `DD-0${seed}`, state: state === "완료" ? "확정" : "검토 대기" },
  };
}

/** reqKey는 화면에 그대로 표시만 하고, 실제 도출 로직은 아직 없다 — 예시 이슈 3건 고정. */
export function buildMockIssues(): DevIssue[] {
  return [
    { ...FULL_ISSUE, key: "AMVCS30-77" },
    lightIssue("AMVCS30-78", "알람 발생 시 재할당", "검토 대기", 2),
    lightIssue("AMVCS30-79", "우선순위 기반 정렬", "완료", 3),
  ];
}

export function findMockIssue(issueKey: string): DevIssue | null {
  return buildMockIssues().find((i) => i.key === issueKey) ?? null;
}
