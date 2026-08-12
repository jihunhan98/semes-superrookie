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
