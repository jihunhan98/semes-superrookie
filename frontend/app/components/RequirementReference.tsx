"use client";

import { useState } from "react";
import type { RequirementDetail } from "../lib/api";

/** 산출물 작업 중 요구사항 원문을 바로 참고할 수 있게 접었다 펼 수 있는 패널. */
export default function RequirementReference({ req }: { req: RequirementDetail }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="refpanel">
      <button className="refpanel-head" onClick={() => setOpen((v) => !v)}>
        <span className="refpanel-chevron">{open ? "▾" : "▸"}</span>
        📄 요구사항 원문 참고 — {req.reqKey}
        {req.version && <span className="lbl blue" style={{ padding: "1px 8px" }}>v{req.version}</span>}
      </button>
      {open && (
        <div className="refpanel-body">
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{req.content}</p>
        </div>
      )}
    </div>
  );
}
