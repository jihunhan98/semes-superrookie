"use client";

import { useEffect, useId, useState } from "react";

/**
 * Mermaid 코드를 실제 다이어그램(SVG)으로 그린다.
 *
 * <p>mermaid 는 DOM이 있어야 동작해서 클라이언트에서만 동적 import 한다 — 서버
 * 사이드 렌더링 시점에 번들에 끼워 넣지 않으려는 것(다이어그램이 없는 화면까지
 * mermaid 를 매번 받을 필요는 없다).
 */
export default function MermaidDiagram({ code }: { code: string }) {
  const rawId = useId();
  const id = `mmd-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);

    import("mermaid").then(async (mod) => {
      const mermaid = mod.default;
      mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
      try {
        const { svg: rendered } = await mermaid.render(id, code);
        if (!cancelled) setSvg(rendered);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "다이어그램을 그리지 못했습니다.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    return <p className="lmsg err" style={{ marginBottom: 0 }}>{error}</p>;
  }
  if (!svg) {
    return <div className="placeholder" style={{ padding: "18px 0" }}>다이어그램 그리는 중…</div>;
  }
  // eslint-disable-next-line react/no-danger
  return <div className="mermaidbox" dangerouslySetInnerHTML={{ __html: svg }} />;
}
