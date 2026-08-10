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

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
  return res.json() as Promise<T>;
}

export function signup(input: SignupInput): Promise<User> {
  return postJson<User>("/api/signup", input);
}

export function login(empNo: string, password: string): Promise<User> {
  return postJson<User>("/api/login", { empNo, password });
}
