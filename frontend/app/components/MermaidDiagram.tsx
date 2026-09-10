"use client";

import { useEffect, useId, useRef, useState } from "react";

type CopyState = "idle" | "copied" | "downloaded" | "error";

/**
 * 렌더링된 SVG를 PNG Blob으로 바꾼다 — 클립보드는 image/png만 받아 주는 브라우저가
 * 많아 SVG를 그대로 복사할 수 없다. Image → canvas → toBlob 경로를 쓴다.
 */
async function svgToPngBlob(svgEl: SVGSVGElement): Promise<Blob> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  const rect = svgEl.getBoundingClientRect();
  const viewBox = svgEl.viewBox?.baseVal;
  const width = Math.ceil((viewBox && viewBox.width) || rect.width || 800);
  const height = Math.ceil((viewBox && viewBox.height) || rect.height || 400);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const svgText = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("이미지 변환에 실패했습니다."));
      el.src = url;
    });

    const scale = 2; // 선명하게 — 2배 해상도로 그린다.
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas를 만들지 못했습니다.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("PNG로 변환하지 못했습니다.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Mermaid 코드를 실제 다이어그램(SVG)으로 그린다.
 *
 * <p>mermaid 는 DOM이 있어야 동작해서 클라이언트에서만 동적 import 한다 — 서버
 * 사이드 렌더링 시점에 번들에 끼워 넣지 않으려는 것(다이어그램이 없는 화면까지
 * mermaid 를 매번 받을 필요는 없다).
 *
 * <p>{@code copyable}이면 복사 버튼을 띄운다 — 클립보드에 이미지 쓰기를 지원하는
 * 브라우저면 PNG로 복사하고, 아니면 파일로 내려받는다. 버튼은 다이어그램 위에
 * 떠 있지 않고 {@code label}과 같은 줄(헤더)에 놓여 다이어그램을 가리지 않는다.
 */
export default function MermaidDiagram({
  code,
  copyable,
  label,
}: {
  code: string;
  copyable?: boolean;
  label?: string;
}) {
  const rawId = useId();
  const id = `mmd-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");

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

  async function handleCopy() {
    const svgEl = containerRef.current?.querySelector("svg");
    if (!svgEl) return;
    try {
      const blob = await svgToPngBlob(svgEl as unknown as SVGSVGElement);
      const canWriteImage =
        typeof ClipboardItem !== "undefined" && !!navigator.clipboard && "write" in navigator.clipboard;
      if (canWriteImage) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopyState("copied");
      } else {
        downloadBlob(blob, "sequence-diagram.png");
        setCopyState("downloaded");
      }
    } catch {
      setCopyState("error");
    }
    setTimeout(() => setCopyState("idle"), 1800);
  }

  if (error) {
    return <p className="lmsg err" style={{ marginBottom: 0 }}>{error}</p>;
  }

  const copyLabel =
    copyState === "copied" ? "복사됨" : copyState === "downloaded" ? "다운로드됨"
      : copyState === "error" ? "실패" : "복사";

  return (
    <div>
      {(label || (copyable && svg)) && (
        <div className="seqblockhd">
          {label}
          {copyable && svg && (
            <button type="button" className="btn sm" style={{ marginLeft: "auto" }} onClick={handleCopy}>
              {copyLabel}
            </button>
          )}
        </div>
      )}
      {!svg ? (
        <div className="placeholder" style={{ padding: "18px 0" }}>다이어그램 그리는 중…</div>
      ) : (
        // eslint-disable-next-line react/no-danger
        <div ref={containerRef} className="mermaidbox" dangerouslySetInnerHTML={{ __html: svg }} />
      )}
    </div>
  );
}
