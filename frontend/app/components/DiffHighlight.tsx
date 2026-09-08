"use client";

import { useState } from "react";
import type { DiffRow } from "../lib/api";

type ItemType = "add" | "del" | "change";
type Item = { idx: number; type: ItemType; baseText: string | null; headText: string | null };

const TYPE_LABEL: Record<ItemType, string> = {
  add: "추가",
  del: "삭제",
  change: "변경",
};

/** 카드·번호 배지 색 — add 는 초록, del 은 기존 상충(cf) 빨강, change 는 기존 애매(amb) 주황을 재사용한다. */
function colorClass(type: ItemType) {
  if (type === "add") return "addc";
  if (type === "del") return "cf";
  return "amb";
}

/**
 * 버전 비교 — git diff 식 좌우 분할 대신, AI 검토 결과와 같은 방식으로 보여준다.
 *
 * <p>본문을 그대로(줄 단위) 보여주고 바뀐 줄에 형광펜을 칠한 뒤, 같은 번호의 카드에서
 * 무엇이 어떻게 바뀌었는지 설명한다. 좌우로 눈을 옮겨가며 맞춰 보는 대신 한 화면에서
 * "무엇이 바뀌었는지"만 바로 보이게 하려는 목적.
 */
export default function DiffHighlight({
  rows,
  headLabel,
  empty,
}: {
  rows: DiffRow[];
  headLabel: string;
  empty: string;
}) {
  const [active, setActive] = useState<number | null>(null);

  const items: Item[] = [];
  const lines = rows.map((r, i) => {
    if (r.type === "ctx") {
      return (
        <div key={i} className="dhline">
          {r.headText || " "}
        </div>
      );
    }

    const item: Item = { idx: items.length, type: r.type, baseText: r.baseText, headText: r.headText };
    items.push(item);

    if (r.type === "del") {
      return (
        <div key={i} className="dhline">
          <mark
            className={`hl del${active === item.idx ? " on" : ""}`}
            onMouseEnter={() => setActive(item.idx)}
            onMouseLeave={() => setActive(null)}
            title="삭제됨"
          >
            {r.baseText || " "}
            <span className="no">{item.idx + 1}</span>
          </mark>
        </div>
      );
    }

    return (
      <div key={i} className="dhline">
        <mark
          className={`hl ${r.type === "add" ? "add" : ""}${active === item.idx ? " on" : ""}`}
          onMouseEnter={() => setActive(item.idx)}
          onMouseLeave={() => setActive(null)}
          title={TYPE_LABEL[item.type]}
        >
          {r.headText || " "}
          <span className="no">{item.idx + 1}</span>
        </mark>
      </div>
    );
  });

  return (
    <>
      <div className="srcbox" style={{ marginBottom: 12 }}>
        <div className="sh">
          {headLabel}
          {items.length > 0 && (
            <span className="shhint">형광펜 = 바뀐 부분 · 번호를 아래 카드와 맞춰 보세요</span>
          )}
        </div>
        <div className="srctext dhtext">{lines}</div>
      </div>

      {items.length === 0 ? (
        <div className="fempty">{empty}</div>
      ) : (
        items.map((it) => (
          <div
            key={it.idx}
            className={`find ${colorClass(it.type) === "cf" ? "cfc" : colorClass(it.type) === "addc" ? "addc" : ""}${
              active === it.idx ? " on" : ""
            }`}
            style={it.idx === items.length - 1 ? { marginBottom: 0 } : undefined}
            onMouseEnter={() => setActive(it.idx)}
            onMouseLeave={() => setActive(null)}
          >
            <div className="ft">
              <span className={`fno ${colorClass(it.type)}`}>{it.idx + 1}</span>
              <span className={`ftype2 ${colorClass(it.type)}`}>{TYPE_LABEL[it.type]}</span>
            </div>
            {it.type === "change" ? (
              <>
                <div className="frs2">이전 — &ldquo;{it.baseText}&rdquo;</div>
                <div className="frs2">이후 — &ldquo;{it.headText}&rdquo;</div>
              </>
            ) : (
              <div className="frs2">&ldquo;{it.type === "del" ? it.baseText : it.headText}&rdquo;</div>
            )}
          </div>
        ))
      )}
    </>
  );
}
