"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** A single focus-contained review window shared by issues and the four artifacts. */
export default function ReviewDialog({ title, breadcrumb, onClose, children }: { title: string; breadcrumb: string; onClose: () => void; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const titleId = useId();
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? []).filter(element => element.getClientRects().length > 0 && !element.matches(":disabled"));
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [mounted]);
  if (!mounted) return null;
  return createPortal(<div className="jira-dialog-overlay"><div ref={dialog} className="jira-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}><header className="jira-dialog-header"><div><span className="jira-breadcrumb">{breadcrumb}</span><h2 id={titleId}>{title}</h2></div><button type="button" className="jira-close" onClick={onClose} aria-label="상세 창 닫기">×</button></header>{children}</div></div>, document.body);
}
