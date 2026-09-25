"use client";

import { useState } from "react";
import MermaidDiagram from "./MermaidDiagram";

export type Step = { from: string; to: string; message: string };

const LINE = /^\s*(.+?)\s*->>\s*(.+?)\s*:\s*(.*)$/;

export function mermaidToSteps(text: string): Step[] {
  const steps: Step[] = [];
  for (const line of text.split("\n")) {
    const m = LINE.exec(line);
    if (m) steps.push({ from: m[1], to: m[2], message: m[3] });
  }
  if (steps.length === 0 && text.trim()) {
    // 예전 형식이거나 손으로 쓴 Mermaid 문법 — 못 알아본 내용은 첫 줄에 그대로 옮겨서 잃어버리지 않게 한다.
    return [{ from: "", to: "", message: text.trim() }];
  }
  return steps;
}

export function stepsToMermaid(steps: Step[]): string {
  const rows = steps.filter((s) => s.from.trim() || s.to.trim() || s.message.trim());
  if (rows.length === 0) return "";
  return "sequenceDiagram\n" + rows.map((s) => `    ${s.from || "?"}->>${s.to || "?"}: ${s.message}`).join("\n");
}

/** 시퀀스 다이어그램을 Mermaid 문법이 아니라 "누가 누구에게 무엇을" 문장으로 작성한다. */
export default function SequenceStepEditor({
  steps, onChange,
}: {
  steps: Step[];
  onChange: (steps: Step[]) => void;
}) {
  const [showPreview, setShowPreview] = useState(true);

  function updateStep(i: number, patch: Partial<Step>) {
    const next = steps.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }

  function addStep() {
    onChange([...steps, { from: "", to: "", message: "" }]);
  }

  function removeStep(i: number) {
    onChange(steps.filter((_, idx) => idx !== i));
  }

  return (
    <div className="seqedit">
      <div className="seqedit-rows">
        {steps.length === 0 && (
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 8px" }}>
            아직 단계가 없습니다. 아래에서 "누가 → 누구에게 → 무엇을" 순서대로 추가하세요.
          </p>
        )}
        {steps.map((s, i) => (
          <div key={i} className="seqrow">
            <span className="seqrow-no">{i + 1}</span>
            <input
              className="seqrow-actor"
              placeholder="보내는 쪽 (예: 사용자)"
              value={s.from}
              onChange={(e) => updateStep(i, { from: e.target.value })}
            />
            <span className="seqrow-arrow">→</span>
            <input
              className="seqrow-actor"
              placeholder="받는 쪽 (예: 백엔드)"
              value={s.to}
              onChange={(e) => updateStep(i, { to: e.target.value })}
            />
            <input
              className="seqrow-msg"
              placeholder="무엇을 하는지 (예: 로그인을 요청한다)"
              value={s.message}
              onChange={(e) => updateStep(i, { message: e.target.value })}
            />
            <button className="seqrow-del" onClick={() => removeStep(i)} aria-label="단계 삭제">
              ✕
            </button>
          </div>
        ))}
      </div>
      <button className="btn sm" onClick={addStep}>
        + 단계 추가
      </button>

      <div className="seqedit-preview-toggle">
        <button className="btn sm" onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? "미리보기 숨기기" : "미리보기 보기"}
        </button>
      </div>
      {showPreview && (
        <div className="mmd-box" style={{ marginTop: 8 }}>
          <MermaidDiagram code={stepsToMermaid(steps)} />
        </div>
      )}
    </div>
  );
}
