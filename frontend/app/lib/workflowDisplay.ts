import type { ReqState } from "./api";

/** 요구사항의 등록부터 확정까지 화면에 표시하는 세 단계. */
export function displayStep(state: ReqState): 1 | 2 | 3 {
  if (state === "RECEIVED") return 1;
  if (state === "CONFIRMED") return 3;
  return 2;
}

export const STEP_LABELS = ["등록", "검토·수정", "완료"] as const;
export const STEP_COLORS = ["#9aa5b1", "#0969da", "#1f883d"] as const;
