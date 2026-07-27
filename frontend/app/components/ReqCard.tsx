import type { ReqResult } from "../lib/api";
import { highlightSpans } from "../lib/highlight";

/** 요구사항의 작업 상태 — 분석 결과 + 프론트 해결 상태를 합친 것. */
export type WorkingReq = ReqResult & {
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

/** REQ 헤더: ID + 분류 배지 + 상태 배지. */
function Head({ r, badge }: { r: WorkingReq; badge: React.ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className="font-mono text-xs font-semibold text-gray-500">{r.id}</span>
      {r.category && (
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
          {r.category}
        </span>
      )}
      {badge}
    </div>
  );
}

/** 내용/비고 본문 — findings의 span을 하이라이트해서 보여준다. */
function Body({ r, highlight }: { r: WorkingReq; highlight: boolean }) {
  const f = highlight ? r.findings : [];
  return (
    <div className="space-y-2 text-sm text-gray-800">
      {r.content && (
        <div>
          <span className="mr-1 text-[11px] font-semibold text-gray-400">내용</span>
          <span className="whitespace-pre-wrap">{highlightSpans(r.content, f)}</span>
        </div>
      )}
      {r.remark && (
        <div>
          <span className="mr-1 text-[11px] font-semibold text-gray-400">비고</span>
          <span className="whitespace-pre-wrap">{highlightSpans(r.remark, f)}</span>
        </div>
      )}
    </div>
  );
}

export function ReqCard({ r, h }: { r: WorkingReq; h: Handlers }) {
  // 명확
  if (!r.ambiguous) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <Head
          r={r}
          badge={
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              ✓ 명확
            </span>
          }
        />
        <Body r={r} highlight={false} />
      </div>
    );
  }

  // 해결 완료 → 전후 비교
  if (r.state === "resolved") {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50/40 p-4">
        <Head
          r={r}
          badge={
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
              🔒 확정
            </span>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-gray-200 bg-white p-3">
            <div className="mb-1 text-xs font-semibold text-gray-400">해결 전 (원본)</div>
            <Body r={r} highlight={false} />
          </div>
          <div className="rounded-md border border-emerald-300 bg-white p-3">
            <div className="mb-1 text-xs font-semibold text-emerald-600">
              해결 후 (확정 해석)
            </div>
            <p className="whitespace-pre-wrap text-sm text-gray-800">{r.resolution}</p>
          </div>
        </div>
      </div>
    );
  }

  // 넘어감
  if (r.state === "skipped") {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <Head
          r={r}
          badge={
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
              넘어감 (해결 불필요)
            </span>
          }
        />
        <Body r={r} highlight={false} />
      </div>
    );
  }

  // 모호 (미해결) — 검출 + 해결 입력
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50/40 p-4">
      <Head
        r={r}
        badge={
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white">
            ⚠ 모호 · {r.findings.length}건
          </span>
        }
      />
      <div className="mb-3">
        <Body r={r} highlight={true} />
      </div>

      <ul className="mb-3 space-y-1.5 border-t border-amber-200 pt-3">
        {r.findings.map((f, i) => (
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

      {r.suggestion && r.state !== "open" && (
        <div className="mb-3 rounded-md border border-dashed border-sky-300 bg-sky-50 p-2 text-sm text-sky-800">
          ✎ 보완 방향: {r.suggestion}
        </div>
      )}

      {r.state !== "open" ? (
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
            확정 해석 입력 — 이 요구사항을 어떻게 해석·확정할지 적는다
          </label>
          <textarea
            value={r.draft}
            onChange={(e) => h.onDraft(e.target.value)}
            placeholder="예: '허용 여부' = 동일 자재 ID에 대해 최대 1건만 허용"
            className="h-24 w-full rounded border border-gray-300 p-2 text-sm"
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
