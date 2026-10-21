"use client";
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { placeholders } from "../lib/review/edits.mjs";

export type TextRange = { start: number; end: number; stale?: boolean };
export type ReviewEditorHandle = { focusRange: (start: number, end: number) => void };
export function MarkedReviewText({ value, ranges = [] }: { value: string; ranges?: TextRange[] }) {
  const slots = placeholders(value);
  const edges = [...new Set([0, value.length, ...ranges.filter(r => !r.stale).flatMap(r => [r.start, r.end]), ...slots.flatMap(r => [r.start, r.end])])].filter(n => n >= 0 && n <= value.length).sort((a, b) => a-b);
  return <>{edges.slice(0, -1).map((start, i) => {
    const end = edges[i+1];
    const slot = slots.some(r => r.start <= start && r.end >= end);
    const changed = ranges.some(r => !r.stale && r.start <= start && r.end >= end);
    return <span key={start} className={slot ? "review-input-needed" : changed ? "review-changed" : undefined}>{value.slice(start, end)}</span>;
  })}</>;
}
const ReviewTextEditor = forwardRef<ReviewEditorHandle, {value: string; onChange: (value: string) => void; ranges: TextRange[]; disabled?: boolean}>(function ReviewTextEditor({value, onChange, ranges, disabled}, ref) {
  const input = useRef<HTMLTextAreaElement>(null);
  const fit = () => { const el = input.current; if (!el) return; el.style.height = "0px"; el.style.height = `${el.scrollHeight}px`; };
  useLayoutEffect(() => { fit(); const el = input.current; if (!el) return; const observer = new ResizeObserver(fit); observer.observe(el.parentElement!); return () => observer.disconnect(); }, [value]);
  useImperativeHandle(ref, () => ({ focusRange(start, end) { const el = input.current; if (!el) return; el.focus(); el.setSelectionRange(start, end); const lineHeight=27; const line=value.slice(0,start).split("\n").length-1; window.scrollTo({top: el.getBoundingClientRect().top + window.scrollY + Math.min(line*lineHeight,el.scrollHeight)-180, behavior:"smooth"}); } }), [value]);
  return <div className="review-text-editor"><pre aria-hidden="true"><MarkedReviewText value={value} ranges={ranges} />{"\n"}</pre><textarea ref={input} aria-label="확정될 본문" spellCheck={false} disabled={disabled} value={value} onChange={e=>onChange(e.target.value)} /></div>;
});
export default ReviewTextEditor;
