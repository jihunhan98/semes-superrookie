import type { ClauseResult } from "../lib/api";
import { highlightSpans } from "../lib/highlight";

/** 조항의 작업 상태 — 분석 결과 + 프론트 해결 상태를 합친 것. */
export type WorkingClause = ClauseResult & {
  // clear=명확, detected=모호 검출됨(미해결), open=해석 입력 중,
  // resolved=확정, skipped=넘어감
  state: "clear" | "detected" | "open" | "resolved" | "skipped";
  draft: string; // 해결 입력 중인 초안
  resolution: string; // 확정된 해석
};

/** 모호성 유형별 배지 색. */
const TYPE_COLOR: Record<string, string> = {
  "정량 기준 부재": "bg-rose-100 text-rose-700",
  "모호한 정도부사": "bg-orange-100 text-orange-700",
  "주어/주체 불명확": "bg-amber-100 text-amber-700",
  "조건 발생 시점 불명확": "bg-lime-100 text-lime-700",
  "예외/경계 조건 누락": "bg-teal-100 text-teal-700",
  "접속사 범위 모호": "bg-sky-100 text-sky-700",
  "시간·일정 모호": "bg-violet-100 text-violet-700",
};

function typeColor(t: string) {
  return TYPE_COLOR[t] ?? "bg-gray-100 text-gray-700";
}

type Handlers = {
  onOpen: () => void;
  onDraft: (v: string) => void;
  onConfirm: () => void;
  onSkip: () => void;
};

export function ClauseCard({ c, h }: { c: WorkingClause; h: Handlers }) {
  const rid = (
    <span className="font-mono text-xs text-gray-400">{c.reqId}</span>
  );

  // 명확
  if (!c.ambiguous) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-1 flex items-center gap-2">
          {rid}
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            ✓ 명확
          </span>
        </div>
        <p className="text-gray-800">{c.text}</p>
      </div>
    );
  }

  // 해결 완료 → 전후 비교
  if (c.state === "resolved") {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50/40 p-4">
        <div className="mb-2 flex items-center gap-2">
          {rid}
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
            🔒 확정
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-gray-200 bg-white p-3">
            <div className="mb-1 text-xs font-semibold text-gray-400">
              해결 전 (원본)
            </div>
            <p className="text-sm text-gray-600 line-through decoration-gray-300">
              {c.text}
            </p>
          </div>
          <div className="rounded-md border border-emerald-300 bg-white p-3">
            <div className="mb-1 text-xs font-semibold text-emerald-600">
              해결 후 (확정 해석)
            </div>
            <p className="text-sm text-gray-800">{c.resolution}</p>
          </div>
        </div>
      </div>
    );
  }

  // 넘어감
  if (c.state === "skipped") {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="mb-1 flex items-center gap-2">
          {rid}
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
            넘어감 (해결 불필요)
          </span>
        </div>
        <p className="text-gray-500">{c.text}</p>
      </div>
    );
  }

  // 모호 (미해결) — 검출 + 해결 입력
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50/40 p-4">
      <div className="mb-2 flex items-center gap-2">
        {rid}
        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white">
          ⚠ 모호 · {c.findings.length}건
        </span>
      </div>

      <p className="mb-3 text-gray-800">{highlightSpans(c.text, c.findings)}</p>

      <ul className="mb-3 space-y-1.5">
        {c.findings.map((f, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-2 text-sm">
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${typeColor(f.type)}`}
            >
              {f.type}
            </span>
            <span className="font-medium text-gray-700">“{f.span}”</span>
            <span className="text-gray-500">— {f.reason}</span>
          </li>
        ))}
      </ul>

      {c.suggestion && c.state !== "open" && (
        <div className="mb-3 rounded-md border border-dashed border-sky-300 bg-sky-50 p-2 text-sm text-sky-800">
          ✎ 이렇게 쓰면 명확: {c.suggestion}
        </div>
      )}

      {c.state !== "open" ? (
        <div className="flex gap-2">
          <button
            onClick={h.onOpen}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
          >
            해결하기
          </button>
          <button
            onClick={h.onSkip}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            해결 불필요 · 넘어가기
          </button>
        </div>
      ) : (
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <label className="mb-1 block text-xs font-semibold text-gray-500">
            확정 해석 입력 — 이 조항을 어떻게 해석·확정할지 적는다
          </label>
          <textarea
            value={c.draft}
            onChange={(e) => h.onDraft(e.target.value)}
            placeholder="예: '충분한 내구성' = MTBF 10,000시간 이상"
            className="h-20 w-full rounded border border-gray-300 p-2 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={h.onConfirm}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
            >
              확정
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
