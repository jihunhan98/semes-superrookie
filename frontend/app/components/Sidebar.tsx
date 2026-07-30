"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FEATURES } from "../lib/nav";

export function Sidebar() {
  // trailingSlash: true 라 pathname이 "/ambiguity/" 형태 → 끝 슬래시 제거 후 비교
  const pathname = (usePathname() || "/").replace(/(.)\/$/, "$1");

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
      {/* 로고 / 제품명 */}
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          RA
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-gray-900">요구사항 자동화</span>
          <span className="text-[11px] text-gray-400">SEMES · VCS</span>
        </span>
      </Link>

      {/* 기능 네비게이션 */}
      <nav className="flex-1 space-y-1 px-3">
        <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          핵심 기능
        </p>
        {FEATURES.map((f) => {
          const active = pathname === f.href;
          const done = f.status === "done";
          const Icon = f.icon;
          return (
            <Link
              key={f.href}
              href={f.href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-indigo-50 font-semibold text-indigo-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${active ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-500"}`}
              />
              <span className="flex-1 truncate">{f.name}</span>
              {!done && (
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
                  준비중
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* 하단: 네트워크/모델 안내 */}
      <div className="m-3 rounded-lg bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-400">
        사내 로컬 LLM으로 동작 (반출 차단 환경).
        <br />
        Ollama 미실행 시 규칙 mock으로 폴백.
      </div>
    </aside>
  );
}
