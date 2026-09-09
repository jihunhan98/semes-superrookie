export type Mark = { start: number; end: number; idx: number };

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 정확히 일치하는 자리가 없을 때, 공백(스페이스 개수·줄바꿈)만 다른 경우까지
 * 완화해서 한 번 더 찾는다 — 사람이 구절을 편집하다 띄어쓰기만 살짝 달라진
 * 흔한 경우를 구제하기 위함(내용 자체가 달라진 경우까지 구해주진 않는다).
 */
function findFlexible(content: string, span: string, taken: Array<[number, number]>) {
  const pattern = span.split(/\s+/).filter(Boolean).map(escapeRegExp).join("\\s+");
  if (!pattern) return null;

  const re = new RegExp(pattern, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(content))) {
    const start = match.index;
    const end = start + match[0].length;
    if (!taken.some(([s, e]) => start < e && s < end)) {
      return { start, end };
    }
  }
  return null;
}

/**
 * 구절 목록(spans)이 원문(content)의 어디인지 찾는다.
 *
 * <p>AI는 "어느 구절인지"를 텍스트로만 알려준다. 그 구절이 원문 몇 번째 글자인지는
 * 알려주지 않기 때문에 화면에서 직접 찾아야 한다. 몇 가지를 신경 쓴다.
 *
 * <ul>
 *   <li>같은 구절이 여러 번 나오면 — 아직 표시하지 않은 첫 위치를 쓴다.
 *   <li>구절이 겹치면 — 먼저 잡은 쪽을 남긴다. 겹쳐서 칠하면 DOM이 깨진다.
 *   <li>정확히 일치하는 자리가 없으면 — 공백만 다른 경우까지 한 번 더 완화해서
 *       찾는다({@link findFlexible}). 그래도 못 찾으면 marks에 넣지 않는다(형광펜
 *       없이, 카드 쪽에서 "원문에서 못 찾음"을 표시할 근거로 located[idx]를
 *       함께 돌려준다).
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

    let found: { start: number; end: number } | null = null;
    let from = 0;
    for (;;) {
      const at = content.indexOf(span, from);
      if (at < 0) break;
      const end = at + span.length;
      if (!taken.some(([s, e]) => at < e && s < end)) {
        found = { start: at, end };
        break;
      }
      from = at + 1;
    }

    if (!found) {
      found = findFlexible(content, span, taken);
    }

    if (found) {
      marks.push({ start: found.start, end: found.end, idx });
      taken.push([found.start, found.end]);
      located[idx] = true;
    }
  });

  marks.sort((a, b) => a.start - b.start);
  return { marks, located };
}
