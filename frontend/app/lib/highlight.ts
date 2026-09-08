export type Mark = { start: number; end: number; idx: number };

/**
 * 구절 목록(spans)이 원문(content)의 어디인지 찾는다.
 *
 * <p>AI는 "어느 구절인지"를 텍스트로만 알려준다. 그 구절이 원문 몇 번째 글자인지는
 * 알려주지 않기 때문에 화면에서 직접 찾아야 한다. 세 가지를 신경 쓴다.
 *
 * <ul>
 *   <li>같은 구절이 여러 번 나오면 — 아직 표시하지 않은 첫 위치를 쓴다.
 *   <li>구절이 겹치면 — 먼저 잡은 쪽을 남긴다. 겹쳐서 칠하면 DOM이 깨진다.
 *   <li>구절을 못 찾으면 — marks에 넣지 않는다(형광펜 없이, 카드 쪽에서 "원문에서
 *       못 찾음"을 표시할 근거로 located[idx]를 함께 돌려준다).
 * </ul>
 *
 * <p>AI 검토 결과(AiFindings)와 이슈 나누기 화면이 같은 방식으로 원문에 형광펜을
 * 칠하므로 여기 한 곳에 둔다.
 */
export function locateSpans(content: string, spans: (string | null | undefined)[]) {
  const marks: Mark[] = [];
  const taken: Array<[number, number]> = [];
  const located = spans.map(() => false);

  spans.forEach((raw, idx) => {
    const span = (raw ?? "").trim();
    if (!span) return;

    let from = 0;
    for (;;) {
      const at = content.indexOf(span, from);
      if (at < 0) break;
      const end = at + span.length;
      if (!taken.some(([s, e]) => at < e && s < end)) {
        marks.push({ start: at, end, idx });
        taken.push([at, end]);
        located[idx] = true;
        break;
      }
      from = at + 1;
    }
  });

  marks.sort((a, b) => a.start - b.start);
  return { marks, located };
}
