"use client";

import { useState } from "react";
import { analyze, type Engine, type Mode, type ReqInput } from "../lib/api";
import { ReqCard, type WorkingReq } from "../components/ReqCard";

// 샘플: docx 표의 한 행(ID·분류·내용·비고)에 해당하는 요구사항들
const SAMPLE: ReqInput[] = [
  {
    id: "req-tf-01",
    category: "태스크 전개",
    content:
      "외부 시스템(newAMOS)으로부터 약속된 형식의 이벤트 메시지를 수신받아 신규 태스크를 생성한다.\n사용자 메뉴를 통해 필요한 정보를 입력받아 신규 태스크를 생성한다.",
    remark:
      "신규 태스크 생성을 위한 메시지 형식을 정의한다.\n동일한 자재 ID에 대한 복수의 태스크 생성 허용 여부 등 상세 제약 조건을 정의한다.\n사용자 메뉴를 통한 태스크 생성은 최상위 권한의 계정으로만 가능하게 하며, 필요한 모든 조건이 확인된 것으로 간주한다.",
  },
  {
    id: "req-tf-02",
    category: "태스크 전개",
    content: "진행 상황 보고 항목에 AMR ID, 현재 스텝, 현재 위치를 포함한다.",
    remark: "",
  },
];

const EMPTY_ROW: ReqInput = { id: "", category: "", content: "", remark: "" };

// 실제로 응답한 판정기 → 배지 라벨/색
const MODE_BADGE: Record<Mode, { label: string; cls: string }> = {
  ollama: { label: "로컬 AI · Qwen3-8B", cls: "bg-indigo-100 text-indigo-700" },
  playground: { label: "사내 LLM · Playground", cls: "bg-violet-100 text-violet-700" },
  mock: { label: "mock · 규칙 기반", cls: "bg-gray-200 text-gray-600" },
};

export default function AmbiguityPage() {
  const [rows, setRows] = useState<ReqInput[]>(SAMPLE);
  const [engine, setEngine] = useState<Engine>("local");
  const [results, setResults] = useState<WorkingReq[]>([]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzed, setAnalyzed] = useState(false);

  const setRow = (i: number, patch: Partial<ReqInput>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { ...EMPTY_ROW }]);
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  async function runAnalyze() {
    setBusy(true);
    setError(null);
    try {
      const data = await analyze(rows, engine);
      setMode(data.mode);
      setResults(
        data.reqs.map((r) => ({
          ...r,
          state: r.ambiguous ? "detected" : "clear",
          draft: r.suggestion || "",
          resolution: "",
        })),
      );
      setAnalyzed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setBusy(false);
    }
  }

  const patch = (i: number, p: Partial<WorkingReq>) =>
    setResults((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  function confirm(i: number) {
    const r = results[i];
    if (!r.draft.trim()) {
      alert("확정 해석을 입력하세요.");
      return;
    }
    patch(i, { state: "resolved", resolution: r.draft.trim() });
  }

  const total = results.length;
  const amb = results.filter((r) => r.ambiguous).length;
  const resolved = results.filter((r) => r.state === "resolved").length;
  const unresolved = results.filter(
    (r) => r.ambiguous && r.state !== "resolved" && r.state !== "skipped",
  ).length;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600">
            핵심 기능 1
          </span>
          <h1 className="text-2xl font-bold text-gray-900">모호성 해결</h1>
          {mode && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${MODE_BADGE[mode].cls}`}
            >
              판정: {MODE_BADGE[mode].label}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-sm text-gray-500">
          요구사항(표의 한 행 = ID·분류·내용·비고)을 넣고 분석 → 내용·비고의 모호 지점
          검출 → 해결(해석 확정) 또는 넘어가기 → 해결 전/후 비교.
        </p>
      </header>

      {/* 1. 입력 (편집 가능한 REQ 표) */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            1. 요구사항 입력{" "}
            <span className="font-normal text-gray-400">(행 하나 = 요구사항 하나)</span>
          </h2>
          <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-400">
            docx 업로드는 준비중 — 지금은 직접 입력
          </span>
        </div>

        <div className="space-y-3">
          {rows.map((r, i) => (
            <ReqRow
              key={i}
              r={r}
              index={i}
              canRemove={rows.length > 1}
              onChange={(p) => setRow(i, p)}
              onRemove={() => removeRow(i)}
            />
          ))}
        </div>

        <button
          onClick={addRow}
          className="mt-3 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700"
        >
          + 행 추가
        </button>

        {/* 판정 엔진 선택 — 로컬 AI vs 사내 LLM 비교 */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
          <span className="text-xs font-medium text-gray-500">판정 엔진</span>
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            <EngineBtn active={engine === "local"} onClick={() => setEngine("local")}>
              로컬 AI · Qwen3-8B
            </EngineBtn>
            <EngineBtn
              active={engine === "playground"}
              onClick={() => setEngine("playground")}
            >
              사내 LLM · Playground
            </EngineBtn>
          </div>
          <span className="text-xs text-gray-400">
            {engine === "local"
              ? "사내 워크스테이션 Ollama"
              : "사내 LLM API 서비스(OpenAI 호환)"}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={runAnalyze}
            disabled={busy}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            {busy ? "분석 중…" : "분석"}
          </button>
          {busy && (
            <span className="text-xs text-gray-400">
              모델 첫 호출이면 수십 초 걸릴 수 있습니다.
            </span>
          )}
          {error && <span className="text-sm text-rose-600">실패: {error}</span>}
        </div>

        {analyzed && (
          <div className="mt-4 flex flex-wrap gap-4 border-t border-gray-100 pt-3 text-sm">
            <Kpi label="전체" value={total} />
            <Kpi label="모호" value={amb} tone="amber" />
            <Kpi label="해결" value={resolved} tone="emerald" />
            <Kpi label="미해결" value={unresolved} tone="rose" />
          </div>
        )}
      </section>

      {/* 2. 검출 & 해결 */}
      {analyzed && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">2. 검출 &amp; 해결</h2>
          {results.map((r, i) => (
            <ReqCard
              key={r.id + i}
              r={r}
              h={{
                onOpen: () => patch(i, { state: "open" }),
                onDraft: (v) => patch(i, { draft: v }),
                onConfirm: () => confirm(i),
                onSkip: () => patch(i, { state: "skipped" }),
              }}
            />
          ))}
        </section>
      )}
    </div>
  );
}

/** 편집 가능한 요구사항 한 행 (ID·분류·내용·비고). */
function ReqRow({
  r,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  r: ReqInput;
  index: number;
  canRemove: boolean;
  onChange: (p: Partial<ReqInput>) => void;
  onRemove: () => void;
}) {
  const inputCls =
    "rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-400 focus:outline-none";
  const areaCls =
    "w-full rounded border border-gray-300 p-2 text-sm leading-relaxed focus:border-indigo-400 focus:outline-none";
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-gray-400">#{index + 1}</span>
        <input
          className={`${inputCls} w-32 font-mono`}
          value={r.id}
          onChange={(e) => onChange({ id: e.target.value })}
          placeholder="ID (req-tf-01)"
        />
        <input
          className={`${inputCls} w-40`}
          value={r.category}
          onChange={(e) => onChange({ category: e.target.value })}
          placeholder="분류 (태스크 전개)"
        />
        {canRemove && (
          <button
            onClick={onRemove}
            className="ml-auto rounded px-2 py-1 text-xs text-gray-400 hover:bg-rose-50 hover:text-rose-600"
          >
            삭제
          </button>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-0.5 block text-[11px] font-semibold text-gray-400">내용</label>
          <textarea
            className={`${areaCls} h-24`}
            value={r.content}
            onChange={(e) => onChange({ content: e.target.value })}
            placeholder="요구사항 내용"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] font-semibold text-gray-400">비고</label>
          <textarea
            className={`${areaCls} h-24`}
            value={r.remark}
            onChange={(e) => onChange({ remark: e.target.value })}
            placeholder="제약·정의 항목 (선택)"
          />
        </div>
      </div>
    </div>
  );
}

function EngineBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

function Kpi({
  label,
  value,
  tone = "gray",
}: {
  label: string;
  value: number;
  tone?: "gray" | "amber" | "emerald" | "rose";
}) {
  const color = {
    gray: "text-gray-800",
    amber: "text-amber-600",
    emerald: "text-emerald-600",
    rose: "text-rose-600",
  }[tone];
  return (
    <span className="text-gray-500">
      {label} <b className={`text-base ${color}`}>{value}</b>
    </span>
  );
}
