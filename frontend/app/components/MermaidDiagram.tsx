"use client";

import { useEffect, useId, useRef, useState } from "react";
import ReviewIcon from "./ReviewIcon";
import styles from "./MermaidDiagram.module.css";

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
  appearance = "standard",
}: {
  code: string;
  copyable?: boolean;
  label?: string;
  appearance?: "standard" | "jira";
}) {
  const rawId = useId();
  const id = `mmd-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [naturalWidth,setNaturalWidth]=useState<number|null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [expanded, setExpanded] = useState(false);
  const [zoom,setZoom]=useState(1);
  const dialogRef=useRef<HTMLDivElement>(null);

  // 확대 보기가 떠 있는 동안은 뒤 페이지가 스크롤되지 않게 한다.
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    const focused=document.activeElement as HTMLElement|null;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      focused?.focus();
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { setExpanded(false); return; }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable=Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]'));
      if (!focusable.length) { e.preventDefault(); dialogRef.current.focus(); return; }
      const first=focusable[0],last=focusable[focusable.length-1];
      if (e.shiftKey && (document.activeElement===first || document.activeElement===dialogRef.current)) {e.preventDefault();last.focus();}
      else if (!e.shiftKey && document.activeElement===last) {e.preventDefault();first.focus();}
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setNaturalWidth(null);
    setError(null);
    setZoom(1);

    import("mermaid").then(async (mod) => {
      const mermaid = mod.default;
      mermaid.initialize({ startOnLoad: false, theme: "base", securityLevel: "strict", fontFamily:"Pretendard, Segoe UI, sans-serif", themeVariables:{primaryColor:"#f0f5fd",primaryTextColor:"#344e70",primaryBorderColor:"#a7bedc",lineColor:"#8199b7",secondaryColor:"#f6f9fd",tertiaryColor:"#f5f8fc",actorBkg:"#edf3fc",actorBorder:"#9fb8d8",actorTextColor:"#344e70",signalColor:"#6e89aa",signalTextColor:"#49627f",noteBkgColor:"#f4f7fc",noteBorderColor:"#c9d7e9",noteTextColor:"#637c9b",fontSize:"13px"} });
      try {
        // 문법 검사만 먼저 한다 — parse()는 DOM을 건드리지 않아서, 코드가 잘못됐을 때
        // render()가 (실패 도중) 우리 카드 밖 document.body에 남겨두는 임시/에러
        // 노드가 아예 생기지 않는다(페이지 엉뚱한 곳에 오류가 떠 있던 원인).
        await mermaid.parse(code);
        const { svg: rendered } = await mermaid.render(id, code);
        if (!cancelled) {
          const node=new DOMParser().parseFromString(rendered,"image/svg+xml").documentElement;
          const width=Number(node.getAttribute("viewBox")?.trim().split(/[ ,]+/)[2]);
          setNaturalWidth(Number.isFinite(width)&&width>0?width:null);
          setSvg(rendered);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "다이어그램을 그리지 못했습니다.");
        // render()가 실패해도 document.body에 오류 SVG를 "d" + id 라는 id로 직접
        // 끼워 넣어 버린다(우리 카드 밖, 우리가 관리하지 않는 위치 — 페이지 엉뚱한
        // 곳에 오류가 떠 있던 원인). parse()로 미리 걸러서 render()가 거의 호출되지
        // 않게 했지만, 혹시 몰라 방어적으로도 정리한다.
        document.getElementById(`d${id}`)?.remove();
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

  if (error) return <div className={styles.error} role="alert"><ReviewIcon name="alert" size={17}/><div><b>다이어그램을 표시하지 못했습니다.</b><p>{error}</p><details><summary>저장된 다이어그램 코드 확인</summary><pre>{code}</pre></details></div></div>;
  const copyLabel=copyState==='copied'?'복사됨':copyState==='downloaded'?'저장됨':copyState==='error'?'복사 실패':'이미지 복사';
  const controls=<div className={styles.controls}><button type="button" disabled={!svg||zoom<=.5} onClick={()=>setZoom(v=>Math.max(.5,v-.25))} aria-label="다이어그램 축소"><ReviewIcon name="minus" size={14}/></button><button type="button" disabled={!svg} onClick={()=>setZoom(1)} title="화면에 맞춤">{Math.round(zoom*100)}%</button><button type="button" disabled={!svg||zoom>=2.5} onClick={()=>setZoom(v=>Math.min(2.5,v+.25))} aria-label="다이어그램 확대"><ReviewIcon name="plus" size={14}/></button></div>;
  return <div className={`${styles.diagram} ${appearance==='jira'?styles.jira:''}`}>
   <div className={styles.toolbar}><span><ReviewIcon name="diagram" size={15}/>{label??'다이어그램'}</span><div>{controls}{copyable&&<button type="button" className={styles.textButton} disabled={!svg} onClick={handleCopy}>{copyLabel}</button>}<button type="button" className={styles.textButton} disabled={!svg} onClick={()=>setExpanded(true)} aria-label="다이어그램 크게 보기"><ReviewIcon name="expand" size={14}/><span>크게 보기</span></button></div></div>
   {!svg?<div className={styles.loading} role="status"><span/>다이어그램을 그리는 중입니다.</div>:<div className={styles.viewport} aria-label={label??'다이어그램'} tabIndex={0}><div ref={containerRef} className={styles.drawing} style={{width:`${zoom*100}%`,maxWidth:appearance==='jira'&&naturalWidth?`${naturalWidth*zoom}px`:undefined}} dangerouslySetInnerHTML={{__html:svg}}/></div>}
   {expanded&&svg&&<div className={styles.overlay} onClick={()=>setExpanded(false)}><div className={styles.lightbox} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label??'다이어그램 크게 보기'} onClick={e=>e.stopPropagation()}><div className={styles.toolbar}><span><ReviewIcon name="diagram" size={17}/>{label??'다이어그램'}</span><div>{controls}<button type="button" className={styles.textButton} onClick={()=>setExpanded(false)} aria-label="확대 보기 닫기"><ReviewIcon name="close" size={17}/></button></div></div><div className={styles.fullViewport} tabIndex={0}><div className={styles.drawing} style={{width:`${zoom*100}%`,maxWidth:appearance==='jira'&&naturalWidth?`${naturalWidth*zoom}px`:undefined}} dangerouslySetInnerHTML={{__html:svg}}/></div><footer>확대 후 스크롤하여 전체 흐름을 확인하세요. Esc 키로 닫을 수 있습니다.</footer></div></div>}
  </div>;
}
