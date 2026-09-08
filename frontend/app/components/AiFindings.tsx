"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Finding } from "../lib/api";
import { locateSpans, type Mark } from "../lib/highlight";

/** 상충은 문장을 고쳐서 해결되는 게 아니라 다른 요구사항과의 문제라 색을 구분한다. */
function isConflict(findingType: string) {
  return findingType.includes("상충");
}

/** 검출 구절(targetSpan)이 원문의 어디인지 찾는다 — 실제 위치 찾기는 lib/highlight 공용 로직. */
function locate(content: string, findings: Finding[]) {
  return locateSpans(content, findings.map((f) => f.targetSpan));
}

/** 원문을 그대로 보여주되 검출된 구절에 번호를 단 형광펜을 칠한다. */
function Highlighted({
  content,
  findings,
  marks,
  dismissed,
  active,
  onActive,
}: {
  content: string;
  findings: Finding[];
  marks: Mark[];
  dismissed: Set<number>;
  active: number | null;
  onActive: (idx: number | null) => void;
}) {
  marks = marks.filter((m) => !dismissed.has(m.idx));
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
 * <p>상세·수정 두 화면이 같은 결과를 보여주므로 여기 한 곳에 둔다.
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
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);

  // 다시 분석해서 findings 가 통째로 새로 오면 예전 숨김 상태는 의미가 없다 —
  // 인덱스가 다른 검출을 가리킬 수 있으므로 초기화한다.
  useEffect(() => {
    setDismissed(new Set());
  }, [findings]);

  const { marks, located } = useMemo(() => locate(content, findings), [content, findings]);

  function focusFinding(idx: number) {
    setActive(idx);
    cardRefs.current[idx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function dismiss(idx: number) {
    setDismissed((prev) => new Set(prev).add(idx));
    if (active === idx) setActive(null);
  }

  const visible = findings.filter((_, i) => !dismissed.has(i));
  let lastVisibleIdx = -1;
  findings.forEach((_, i) => {
    if (!dismissed.has(i)) lastVisibleIdx = i;
  });

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
          dismissed={dismissed}
          active={active}
          onActive={(idx) => (idx === null ? setActive(null) : focusFinding(idx))}
        />
      </div>

      {dismissed.size > 0 && (
        <div className="fdismissed">
          {dismissed.size}건 숨김
          <button className="btn sm" onClick={() => setDismissed(new Set())}>
            ↺ 모두 다시 보기
          </button>
        </div>
      )}

      {findings.length === 0 ? (
        <div className="fempty">{empty}</div>
      ) : visible.length === 0 ? (
        <div className="fempty">전부 숨겼습니다. 위 &ldquo;모두 다시 보기&rdquo;로 되돌릴 수 있습니다.</div>
      ) : (
        findings.map((f, i) => {
          if (dismissed.has(i)) return null;
          const conflict = isConflict(f.findingType);
          const isLastVisible = i === lastVisibleIdx;
          return (
            <div
              key={i}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className={`find${active === i ? " on" : ""}${conflict ? " cfc" : ""}`}
              style={isLastVisible ? { marginBottom: 0 } : undefined}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <button
                type="button"
                className="fdismiss"
                title="이 제안 숨기기"
                aria-label="이 제안 숨기기"
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss(i);
                }}
              >
                ✕
              </button>
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
