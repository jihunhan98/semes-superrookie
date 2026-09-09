/**
 * 이슈 나누기 화면에서 이슈 후보마다 순환해서 쓰는 색 — 개발 이슈가 확정된 뒤
 * 카드 목록 화면(`artifacts/[reqId]`)에서도 같은 색을 이어서 쓴다. 몇 개로
 * 나뉠지 미리 알 수 없어서(1개~N개) 색 이름별 클래스 대신 순환 팔레트를 쓴다.
 */
export const ISSUE_PALETTE = [
  { m: "var(--red)", ms: "var(--red-soft)" },
  { m: "var(--amber)", ms: "var(--amber-soft)" },
  { m: "var(--purple)", ms: "var(--purple-soft)" },
  { m: "var(--green)", ms: "var(--green-soft)" },
  { m: "var(--accent)", ms: "var(--accent-soft)" },
];

export function issueColor(index: number) {
  return ISSUE_PALETTE[index % ISSUE_PALETTE.length];
}
