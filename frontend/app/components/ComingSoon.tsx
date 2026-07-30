import type { ReactNode } from "react";

/** 아직 구현되지 않은 기능 페이지의 공통 자리표시(placeholder). */
export function ComingSoon({
  no,
  name,
  desc,
  icon,
  planned,
}: {
  no: string;
  name: string;
  desc: string;
  icon: ReactNode;
  planned: string[];
}) {
  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
            {no}
          </span>
          <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
            미구현 · 준비중
          </span>
        </div>
        <p className="mt-1.5 text-sm text-gray-500">{desc}</p>
      </header>

      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
          {icon}
        </div>
        <h2 className="text-lg font-semibold text-gray-700">아직 구현되지 않았습니다</h2>
        <p className="mt-1 text-sm text-gray-400">
          이 기능은 다음 단계에서 개발할 예정입니다. 현재는{" "}
          <span className="font-medium text-indigo-600">모호성 해결</span>만 동작합니다.
        </p>

        <div className="mx-auto mt-6 max-w-md rounded-lg bg-gray-50 p-4 text-left">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            개발 예정 범위
          </p>
          <ul className="space-y-1.5">
            {planned.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="mt-0.5 text-gray-300">▢</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
