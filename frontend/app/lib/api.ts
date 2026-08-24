// 백엔드(Spring Boot) 주소. 세션/토큰 없음 — 로그인 결과 user만 받아 사용.
export const BACKEND = process.env.NEXT_PUBLIC_BACKEND ?? "http://localhost:8080";

export type User = {
  id: number;
  empNo: string;
  name: string;
  dept: string | null;
};

export type SignupInput = {
  empNo: string;
  name: string;
  dept: string;
  password: string;
};

export type Role = "OWNER" | "MEMBER";

export type ProjectSummary = {
  id: number;
  name: string;
  customer: string | null;
  description: string | null;
  role: Role;
  memberCount: number;
};

export type ProjectMember = {
  userId: number;
  name: string;
  empNo: string | null;
  dept: string | null;
  role: Role;
};

export type ProjectDetail = {
  id: number;
  name: string;
  customer: string | null;
  description: string | null;
  role: Role;
  token: string | null;
  members: ProjectMember[];
};

export type ProjectInput = {
  userId: number;
  name: string;
  customer: string;
  description: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    let message = "요청이 실패했습니다.";
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function getJson<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

function postJson<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined });
}

function patchJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function signup(input: SignupInput): Promise<User> {
  return postJson<User>("/api/signup", input);
}

export function login(empNo: string, password: string): Promise<User> {
  return postJson<User>("/api/login", { empNo, password });
}

export function listProjects(userId: number): Promise<ProjectSummary[]> {
  return getJson<ProjectSummary[]>(`/api/projects?userId=${userId}`);
}

export function createProject(input: ProjectInput): Promise<ProjectDetail> {
  return postJson<ProjectDetail>("/api/projects", input);
}

export function joinProject(userId: number, token: string): Promise<ProjectSummary> {
  return postJson<ProjectSummary>("/api/projects/join", { userId, token });
}

export function getProject(id: number, userId: number): Promise<ProjectDetail> {
  return getJson<ProjectDetail>(`/api/projects/${id}?userId=${userId}`);
}

export function updateProject(id: number, input: ProjectInput): Promise<ProjectDetail> {
  return patchJson<ProjectDetail>(`/api/projects/${id}`, input);
}

export function reissueToken(id: number, userId: number): Promise<{ token: string }> {
  return postJson<{ token: string }>(`/api/projects/${id}/token/reissue?userId=${userId}`);
}

// ── 요구사항 (기능 2) ──────────────────────────────────────────

export type ReqState =
  | "RECEIVED"
  | "IN_REVIEW"
  | "PENDING_CONSENSUS"
  | "CONFIRMED"
  | "REVISING"
  | "ON_HOLD";

/** AI 검토 결과 한 건 — 화면에서 읽기 전용으로만 보여준다. */
export type Finding = {
  findingType: string;
  targetSpan: string | null;
  reason: string | null;
  suggestion: string | null;
  /** 상충 유형일 때 상대 요구사항 ID. 그 외에는 null. */
  conflictReqKey: string | null;
};

export type RequirementSummary = {
  id: number;
  reqKey: string;
  content: string;
  state: ReqState;
  stateLabel: string;
  version: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  findingCount: number;
  updatedAt: string | null;
};

/** 고객 합의 기록. 이 기록이 있어야만 확정할 수 있다. */
export type Consensus = {
  id: number;
  method: string;
  customerContact: string;
  agreedOn: string;
  note: string | null;
  /** 합의 시점의 본문. 지금 본문과 다르면 재합의가 필요하다는 신호. */
  agreedContent: string;
  recordedByName: string | null;
  createdAt: string | null;
  /** 이 합의로 확정된 버전. 아직 확정에 안 쓰였으면 null — 다음 확정의 근거가 된다. */
  usedForVersion: string | null;
};

/** 확정 이력 한 줄. */
export type RequirementVersion = {
  id: number;
  version: string;
  title: string;
  content: string;
  /** 이전 버전 대비 어느 자리가 올랐는지. 첫 확정은 MINOR. */
  kind: "MAJOR" | "MINOR" | "PATCH";
  confirmedByName: string | null;
  createdAt: string | null;
};

/** 버전 비교 diff 한 행 — split 뷰가 좌우를 나란히 그릴 수 있게 짝지어져 있다. */
export type DiffRow = {
  type: "ctx" | "add" | "del" | "change";
  baseNo: number | null;
  baseText: string | null;
  headNo: number | null;
  headText: string | null;
};

export type CompareResult = {
  baseVersion: string | null;
  headVersion: string;
  headTitle: string;
  headConfirmedByName: string | null;
  headCreatedAt: string | null;
  added: number;
  removed: number;
  rows: DiffRow[];
};

export type RequirementDetail = {
  id: number;
  projectId: number;
  reqKey: string;
  content: string;
  requesterDept: string | null;
  requesterName: string | null;
  state: ReqState;
  stateLabel: string;
  version: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  /** AI 제안이 이미 반영된 문장 — 확정 화면 본문에 미리 채워지는 값. */
  aiDraftContent: string;
  aiEngine: string;
  findings: Finding[];
  /** 가장 최근 합의 기록. 없으면 null — 이 값이 null 이면 확정할 수 없다. */
  consensus: Consensus | null;
  canConfirm: boolean;
  /** 확정하면 부여될 버전 — 화면에 "확정 시 v1.0.0" 으로 미리 보여준다. */
  nextVersion: string;
  versions: RequirementVersion[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type ConsensusInput = {
  userId: number;
  method: string;
  customerContact: string;
  /** yyyy-MM-dd */
  agreedOn: string;
  note: string;
  /** 이 합의로 확정하기로 한 본문 — 화면의 "확정될 본문" 값. */
  agreedContent: string;
};

export type RequirementInput = {
  userId: number;
  reqKey: string;
  content: string;
  requesterDept: string;
  requesterName: string;
};

export type AssigneeCandidate = { userId: number; name: string };

export function listRequirements(projectId: number, userId: number): Promise<RequirementSummary[]> {
  return getJson<RequirementSummary[]>(`/api/projects/${projectId}/requirements?userId=${userId}`);
}

export function listAssignees(projectId: number, userId: number): Promise<AssigneeCandidate[]> {
  return getJson<AssigneeCandidate[]>(`/api/projects/${projectId}/requirements/assignees?userId=${userId}`);
}

/**
 * 요구사항 등록.
 *
 * 저장 + AI 초기 검토가 끝난 뒤에 응답이 온다(동기). 그래서 이 Promise 가 풀릴 때까지
 * 화면에 로딩을 띄워야 하고, 응답에는 AI 참고 의견이 이미 들어 있다.
 */
export function createRequirement(projectId: number, input: RequirementInput): Promise<RequirementDetail> {
  return postJson<RequirementDetail>(`/api/projects/${projectId}/requirements`, input);
}

export function getRequirement(
  projectId: number,
  requirementId: number,
  userId: number,
): Promise<RequirementDetail> {
  return getJson<RequirementDetail>(
    `/api/projects/${projectId}/requirements/${requirementId}?userId=${userId}`,
  );
}

export function reanalyzeRequirement(
  projectId: number,
  requirementId: number,
  userId: number,
): Promise<RequirementDetail> {
  return postJson<RequirementDetail>(
    `/api/projects/${projectId}/requirements/${requirementId}/analyze?userId=${userId}`,
  );
}

/**
 * 확정본 수정 시 AI 검토 — 확정본 대비 바뀐 부분과 사유만 본다.
 *
 * 확정본(baseContent)은 서버가 DB에서 가져오므로 보내지 않는다.
 */
export function diffAnalyzeRequirement(
  projectId: number,
  requirementId: number,
  input: { userId: number; content: string; reason: string },
): Promise<RequirementDetail> {
  return postJson<RequirementDetail>(
    `/api/projects/${projectId}/requirements/${requirementId}/diff-analyze`,
    input,
  );
}

/** 고객 합의 기록 — 확정의 전제 조건. */
export function recordConsensus(
  projectId: number,
  requirementId: number,
  input: ConsensusInput,
): Promise<RequirementDetail> {
  return postJson<RequirementDetail>(
    `/api/projects/${projectId}/requirements/${requirementId}/consensus`,
    input,
  );
}

/** 확정 — 합의 기록이 없으면 서버가 409로 거부한다. */
export function confirmRequirement(
  projectId: number,
  requirementId: number,
  input: { userId: number; content: string; title?: string },
): Promise<RequirementDetail> {
  return postJson<RequirementDetail>(
    `/api/projects/${projectId}/requirements/${requirementId}/confirm`,
    input,
  );
}

/**
 * 두 버전 비교 — 화면 6의 split diff.
 *
 * base/head 를 생략하면 서버가 "직전 버전 ↔ 최신 버전"을 골라준다.
 */
export function compareVersions(
  projectId: number,
  requirementId: number,
  userId: number,
  base?: string | null,
  head?: string | null,
): Promise<CompareResult> {
  const q = new URLSearchParams({ userId: String(userId) });
  if (base) q.set("base", base);
  if (head) q.set("head", head);
  return getJson<CompareResult>(
    `/api/projects/${projectId}/requirements/${requirementId}/compare?${q}`,
  );
}

/** 보류 — 고객 협의가 더 필요할 때. 나중에 이어서 확정할 수 있다. */
export function holdRequirement(
  projectId: number,
  requirementId: number,
  userId: number,
): Promise<RequirementDetail> {
  return postJson<RequirementDetail>(
    `/api/projects/${projectId}/requirements/${requirementId}/hold?userId=${userId}`,
  );
}
