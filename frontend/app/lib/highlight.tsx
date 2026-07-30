import type { ReactNode } from "react";
import type { Finding } from "./api";

/**
 * 조항 원문에서 findings의 span 부분을 <mark>로 강조해 렌더한다.
 * 겹치는 구간은 먼저 나온 것만 남긴다(단순화).
 */
export function highlightSpans(text: string, findings: Finding[]): ReactNode {
  const intervals: { start: number; end: number }[] = [];
  for (const f of findings) {
    if (!f.span) continue;
    const start = text.indexOf(f.span);
    if (start < 0) continue;
    intervals.push({ start, end: start + f.span.length });
  }
  intervals.sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  let lastEnd = -1;
  for (const iv of intervals) {
    if (iv.start >= lastEnd) {
      merged.push(iv);
      lastEnd = iv.end;
    }
  }

  if (merged.length === 0) return text;

  const nodes: ReactNode[] = [];
  let cursor = 0;
  merged.forEach((iv, i) => {
    if (cursor < iv.start) nodes.push(text.slice(cursor, iv.start));
    nodes.push(
      <mark
        key={i}
        className="rounded bg-amber-200 px-0.5 font-medium text-amber-900"
      >
        {text.slice(iv.start, iv.end)}
      </mark>,
    );
    cursor = iv.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}
