"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import type { Finding } from "../lib/api";

/** 상충은 문장을 고쳐서 해결되는 게 아니라 다른 요구사항과의 문제라 색을 구분한다. */
function isConflict(findingType: string) {
  return findingType.includes("상충");
}

type Mark = { start: number; end: number; idx: number };

/**
 * 검출 구절(targetSpan)이 원문의 어디인지 찾는다.
 *
 * <p>AI 는 "어느 구절이 문제인지"를 텍스트로만 알려준다. 그 구절이 원문 몇 번째
 * 글자인지는 알려주지 않기 때문에 화면에서 직접 찾아야 한다. 세 가지를 신경 쓴다.
 *
 * <ul>
 *   <li>같은 구절이 여러 번 나오면 — 아직 표시하지 않은 첫 위치를 쓴다. 그래야
 *       "경우에 한하여"가 두 번 나올 때 두 검출이 각각 다른 곳을 가리킨다.
 *   <li>구절이 겹치면 — 먼저 잡은 쪽을 남긴다. 겹쳐서 칠하면 DOM 이 깨진다.
 *   <li>구절을 못 찾으면 — 표시하지 않고 카드에 "원문에서 못 찾음"을 붙인다.
 *       LLM 이 원문에 없는 구절을 지어냈을 때(환각) 조용히 사라지면 안 되므로.
 * </ul>
 */
function locate(content: string, findings: Finding[]) {
  const marks: Mark[] = [];
  const taken: Array<[number, number]> = [];
  const located = findings.map(() => false);

  findings.forEach((f, idx) => {
    const span = (f.targetSpan ?? "").trim();
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

/** 원문을 그대로 보여주되 검출된 구절에 번호를 단 형광펜을 칠한다. */
function Highlighted({
  content,
  findings,
  marks,
  active,
  onActive,
}: {
  content: string;
  findings: Finding[];
  marks: Mark[];
  active: number | null;
  onActive: (idx: number | null) => void;
}) {
  const parts: ReactNode[] = [];
  let cursor = 0;

  marks.forEach((m) => {
    if (m.start > cursor) parts.push(content.slice(cursor, m.start));
    const conflict = isConflict(findings[m.idx].findingType);
    parts.push(
      <mark
        key={`m${m.idx}`}
        id={`hl-${m.idx}`}
        className={`hl ${conflict ? "cf" : "amb"}${active === m.idx ? " on" : ""}`}
        onMouseEnter={() => onActive(m.idx)}
        onMouseLeave={() => onActive(null)}
        title={findings[m.idx].findingType}
      >
        {content.slice(m.start, m.end)}
        <span className="no">{m.idx + 1}</span>
      </mark>
    );
    cursor = m.end;
  });

  if (cursor < content.length) parts.push(content.slice(cursor));
  return <div className="srctext">{parts}</div>;
}

/**
 * AI 검토 결과 본체 — 원문 하이라이트 + 검출 카드.
 *
 * <p>카드에 구절만 적어 두면 "그게 원문 어디인데?"를 사용자가 눈으로 찾아야 한다.
 * 그래서 원문을 먼저 보여주고 그 위에 번호를 칠한 뒤, 같은 번호의 카드에서 왜
 * 문제인지 설명한다. 번호에 마우스를 올리면 원문과 카드가 같이 강조된다.
 *
 * <p>상세·최초 확정·확정본 수정 세 화면이 같은 결과를 보여주므로 여기 한 곳에 둔다.
 */
export default function AiFindings({
  content,
  findings,
  contentLabel = "등록 원문",
  empty,
}: {
  content: string;
  findings: Finding[];
  contentLabel?: string;
  empty: ReactNode;
}) {
  const [active, setActive] = useState<number | null>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);

  const { marks, located } = useMemo(() => locate(content, findings), [content, findings]);

  function focusFinding(idx: number) {
    setActive(idx);
    cardRefs.current[idx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  return (
    <>
      <div className="srcbox">
        <div className="sh">
          {contentLabel}
          {marks.length > 0 && <span className="shhint">형광펜 = AI가 지적한 구절 · 번호를 아래 카드와 맞춰 보세요</span>}
        </div>
        <Highlighted
          content={content}
          findings={findings}
          marks={marks}
          active={active}
          onActive={(idx) => (idx === null ? setActive(null) : focusFinding(idx))}
        />
      </div>

      {findings.length === 0 ? (
        <div className="fempty">{empty}</div>
      ) : (
        findings.map((f, i) => {
          const conflict = isConflict(f.findingType);
          return (
            <div
              key={i}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className={`find${active === i ? " on" : ""}${conflict ? " cfc" : ""}`}
              style={i === findings.length - 1 ? { marginBottom: 0 } : undefined}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <div className="ft">
                <span className={`fno ${conflict ? "cf" : "amb"}`}>{i + 1}</span>
                <span className={`ftype2 ${conflict ? "cf" : "amb"}`}>{f.findingType}</span>
                {f.targetSpan && <span className="fspan2">&ldquo;{f.targetSpan}&rdquo;</span>}
                {/* 원문에서 못 찾은 구절은 위에 형광펜이 안 칠해진다. 왜 없는지 밝혀 둔다. */}
                {f.targetSpan && !located[i] && <span className="nospan">원문에서 위치를 찾지 못함</span>}
              </div>
              {f.reason && <div className="frs2">{f.reason}</div>}
              {f.suggestion && (
                <div className={conflict ? "fconf" : "aisuggest"}>
                  {conflict ? "⚠ " : "✎ 제안: "}
                  {f.suggestion}
                </div>
              )}
              {conflict && f.conflictReqKey && (
                <div className="frs2" style={{ marginTop: 6 }}>
                  상대 요구사항 <b style={{ fontFamily: "var(--mono)" }}>{f.conflictReqKey}</b>
                </div>
              )}
            </div>
          );
        })
      )}
    </>
  );
}
