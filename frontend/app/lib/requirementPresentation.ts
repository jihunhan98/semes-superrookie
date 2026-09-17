import type { ReqState } from "./api";
export const REQUIREMENT_STATES: Record<ReqState, { label: string; color: string }> = {
  RECEIVED: { label: "접수", color: "#71717a" },
  IN_REVIEW: { label: "검토 중", color: "#a16207" },
  PENDING_CONSENSUS: { label: "고객 합의 대기", color: "#7e22ce" },
  CONFIRMED: { label: "확정", color: "#15803d" },
  REVISING: { label: "변경 중", color: "#2563eb" },
  ON_HOLD: { label: "보류", color: "#b45309" },
};
export function formatUpdatedAt(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
