import Link from "next/link";
import { FEATURES } from "./lib/nav";

export default function Home() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">
          고객 요구사항 명세서 자동화
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
          삼성전자가 보낸 요구사항 명세서를 AI로 처리한다. 모호한 표현을 찾아 해석을
          확정하고, 개발할 기능을 도출하며, DB 스키마 변경을 공유한다. 세 가지 핵심 기능
          중 <span className="font-medium text-indigo-600">모호성 해결</span>이 먼저
          구현되어 있다.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => {
          const done = f.status === "done";
          const Icon = f.icon;
          return (
            <Link
              key={f.href}
              href={f.href}
              className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    done
                      ? "bg-indigo-50 text-indigo-600"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    done
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {done ? "구현됨" : "미구현"}
                </span>
              </div>
              <p className="text-xs font-semibold text-gray-400">{f.no}</p>
              <h2 className="mt-0.5 text-base font-bold text-gray-900">{f.name}</h2>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-gray-500">
                {f.desc}
              </p>
              <span
                className={`mt-4 text-sm font-medium ${
                  done
                    ? "text-indigo-600 group-hover:underline"
                    : "text-gray-400"
                }`}
              >
                {done ? "열기 →" : "자세히 보기 →"}
              </span>
            </Link>
          );
        })}
      </div>

      <p className="text-xs text-gray-400">
        아키텍처: React(Next.js) → Spring Boot → FastAPI(AI) · 사내 로컬 LLM(Qwen3-8B) /
        규칙 mock 폴백 · 반출 차단 환경
      </p>
    </div>
  );
}
