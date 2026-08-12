const PALETTE = ["#6e40c9", "#1f883d", "#bf3989", "#0969da", "#9a6700", "#cf222e"];

/** 이름 문자열로부터 항상 같은 색을 뽑아낸다 (아바타·프로젝트 아이콘용). */
export function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
