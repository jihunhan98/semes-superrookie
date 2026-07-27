"use client";

import { useState } from "react";
import { analyze, type Engine, type Mode } from "../lib/api";
import { ClauseCard, type WorkingClause } from "../components/ClauseCard";

// 실제로 응답한 판정기 → 배지 라벨/색
const MODE_BADGE: Record<Mode, { label: string; cls: string }> = {
  ollama: { label: "로컬 AI · Qwen3-8B", cls: "bg-indigo-100 text-indigo-700" },
  playground: { label: "사내 LLM · Playground", cls: "bg-violet-100 text-violet-700" },
  mock: { label: "mock · 규칙 기반", cls: "bg-gray-200 text-gray-600" },
};

const SAMPLE = `1. 태스크 각 스텝별 진행에 필요한 필수 요건이 충족된 상태인 경우에 한하여 태스크를 재전개할 수 있어야 한다.
2. 장비는 충분한 내구성을 가져야 한다.
3. 알람 발생 시 관련 부서와 협의하여 적절히 조치한다.
4. 통신 끊김 시 빠른 시일 내 복구한다.
5. 진행 상황 보고 항목에 AMR ID, 현재 스텝, 현재 위치를 포함한다.`;

type Tab = "text" | "docx";

export default function AmbiguityPage() {
  const [tab, setTab] = useState<Tab>("text");
  const [text, setText] = useState(SAMPLE);
  const [engine, setEngine] = useState<Engine>("local");
  const [clauses, setClauses] = useState<WorkingClause[]>([]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzed, setAnalyzed] = useState(false);

  async function runAnalyze() {
    setBusy(true);
    setError(null);
    try {
      const data = await analyze(text, engine);
      setMode(data.mode);
      setClauses(
        data.clauses.map((c) => ({
          ...c,
          // 초기 상태: 모호하면 '검출됨(미해결)', 명확하면 'clear'
          state: c.ambiguous ? "detected" : "clear",
          draft: c.suggestion || "", // 해결 입력의 초안으로 AI 제안을 미리 채움
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

  const patch = (i: number, p: Partial<WorkingClause>) =>
    setClauses((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...p } : c)));

  function confirm(i: number) {
    const c = clauses[i];
    if (!c.draft.trim()) {
      alert("확정 해석을 입력하세요.");
      return;
    }
    patch(i, { state: "resolved", resolution: c.draft.trim() });
  }

  const total = clauses.length;
  const amb = clauses.filter((c) => c.ambiguous).length;
  const resolved = clauses.filter((c) => c.state === "resolved").length;
  const unresolved = clauses.filter(
    (c) => c.ambiguous && c.state !== "resolved" && c.state !== "skipped",
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
          고객 요구사항 원문(한 줄에 조항 하나)을 넣고 분석 → 모호 조항 검출 →
          해결(해석 확정) 또는 넘어가기 → 해결 전/후 비교.
        </p>
      </header>

      {/* 1. 입력 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">1. 요구사항 입력</h2>

        <div className="mb-3 flex gap-1 border-b border-gray-200">
          <TabButton active={tab === "text"} onClick={() => setTab("text")}>
            텍스트 입력
          </TabButton>
          <TabButton active={tab === "docx"} onClick={() => setTab("docx")}>
            docx 업로드
            <span className="ml-1 rounded bg-gray-100 px-1 text-[10px] text-gray-400">
              준비중
            </span>
          </TabButton>
        </div>

        {tab === "text" ? (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="h-40 w-full rounded-lg border border-gray-300 p-3 text-sm leading-relaxed focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />

            {/* 판정 엔진 선택 — 로컬 AI vs 사내 LLM 비교 */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
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
                disabled={busy || !text.trim()}
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
          </>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
            docx 업로드는 다음 단계에서 지원 예정입니다.
            <br />
            지금은 <b className="text-gray-500">텍스트 입력</b> 탭을 사용하세요.
          </div>
        )}

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
          {clauses.map((c, i) => (
            <ClauseCard
              key={c.reqId}
              c={c}
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

function TabButton({
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
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
        active
          ? "border-indigo-600 text-indigo-600"
          : "border-transparent text-gray-400 hover:text-gray-600"
      }`}
    >
      {children}
    </button>
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
        active
          ? "bg-white text-indigo-700 shadow-sm"
          : "text-gray-500 hover:text-gray-700"
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
