// 백엔드(Spring Boot) REST API 클라이언트 + 타입.
// 프론트는 오직 이 백엔드만 호출한다. (백엔드가 다시 AI 서버로 위임)

export const BACKEND = "http://localhost:8080";

/** DESIGN 2.1 모호성 유형(7종). AI 서버가 이 중 하나로만 분류한다. */
export const AMBIGUITY_TYPES = [
  "정량 기준 부재",
  "모호한 정도부사",
  "주어/주체 불명확",
  "조건 발생 시점 불명확",
  "예외/경계 조건 누락",
  "접속사 범위 모호",
  "시간·일정 모호",
] as const;

export type Finding = {
  span: string;
  type: string;
  reason: string;
};

/** 백엔드가 돌려주는 조항 하나의 분석 결과. */
export type ClauseResult = {
  reqId: string;
  text: string;
  ambiguous: boolean;
  findings: Finding[];
  suggestion: string;
};

/** 판정 엔진: local=사내 로컬 Ollama, playground=사내 LLM API 서비스. */
export type Engine = "local" | "playground";

/** 실제로 응답한 판정기. */
export type Mode = "ollama" | "playground" | "mock";

export type AnalyzeResponse = {
  mode: Mode;
  clauses: ClauseResult[];
};

export async function analyze(
  text: string,
  engine: Engine = "local",
): Promise<AnalyzeResponse> {
  const res = await fetch(`${BACKEND}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, engine }),
  });
  if (!res.ok) throw new Error(`백엔드 오류 (${res.status})`);
  return res.json();
}
