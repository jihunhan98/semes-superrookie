"use client";

import { useState } from "react";

type AnalyzeResult = {
  ambiguous: boolean;
  type: string | null;
  reason: string | null;
};

export default function Home() {
  const [sentence, setSentence] = useState("장비는 충분한 내구성을 가져야 한다.");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("http://localhost:8080/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentence }),
      });
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">요구사항 모호성 검출기 (스파이크)</h1>
      <p className="text-sm text-gray-500">
        React → Spring Boot → FastAPI → Ollama(Qwen2.5) 전체 흐름 테스트
      </p>

      <textarea
        className="w-full border rounded p-3 h-24"
        value={sentence}
        onChange={(e) => setSentence(e.target.value)}
        placeholder="요구사항 문장을 입력하세요"
      />

      <button
        onClick={handleSubmit}
        disabled={loading || !sentence.trim()}
        className="bg-black text-white px-4 py-2 rounded disabled:opacity-40"
      >
        {loading ? "분석 중..." : "모호성 검사"}
      </button>

      {error && <p className="text-red-600">{error}</p>}

      {result && (
        <div className="border rounded p-4 space-y-2">
          <p>
            <strong>모호 여부:</strong>{" "}
            {result.ambiguous ? "❗ 모호함" : "✅ 명확함"}
          </p>
          {result.ambiguous && (
            <>
              <p>
                <strong>유형:</strong> {result.type}
              </p>
              <p>
                <strong>사유:</strong> {result.reason}
              </p>
            </>
          )}
        </div>
      )}
    </main>
  );
}
