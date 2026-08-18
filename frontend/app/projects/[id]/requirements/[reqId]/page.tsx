"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../../components/Header";
import ProjectSidebar from "../../../../components/ProjectSidebar";
import {
  getProject,
  getRequirement,
  reanalyzeRequirement,
  type ProjectDetail,
  type RequirementDetail,
} from "../../../../lib/api";
import { getCurrentUser } from "../../../../lib/session";

/** 상충은 문장 수정으로 해결되지 않으므로 다른 색으로 구분한다. */
function isConflict(findingType: string) {
  return findingType.includes("상충");
}

/** 어느 판정 경로로 나온 결과인지 — 참고 자료의 신뢰 수준을 사용자가 알 수 있게. */
const ENGINE_LABEL: Record<string, string> = {
  "llm-api": "사내 LLM",
  ollama: "로컬 LLM",
  rule: "규칙 기반",
  unavailable: "AI 미응답",
};

export default function RequirementDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string; reqId: string }>();
  const projectId = Number(params.id);
  const requirementId = Number(params.reqId);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [req, setReq] = useState<RequirementDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);

  // 확정될 본문 — AI 제안이 반영된 draft 로 시작하고, 사용자가 자유롭게 편집한다.
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!Number.isFinite(projectId) || !Number.isFinite(requirementId)) return;

    Promise.all([getProject(projectId, user.id), getRequirement(projectId, requirementId, user.id)])
      .then(([p, r]) => {
        setProject(p);
        setReq(r);
        setDraft(r.aiDraftContent);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "요구사항을 불러오지 못했습니다."));
  }, [projectId, requirementId, router]);

  async function onReanalyze() {
    const user = getCurrentUser();
    if (!user) return;
    setReanalyzing(true);
    try {
      const updated = await reanalyzeRequirement(projectId, requirementId, user.id);
      setReq(updated);
      setDraft(updated.aiDraftContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "재분석에 실패했습니다.");
    } finally {
      setReanalyzing(false);
    }
  }

  if (error) {
    return (
      <div className="appshell">
        <Header />
        <main className="main">
          <p className="lmsg err">{error}</p>
        </main>
      </div>
    );
  }

  if (!project || !req) {
    return (
      <div className="appshell">
        <Header />
        <main className="main">
          <div className="placeholder">불러오는 중…</div>
        </main>
      </div>
    );
  }

  const dirty = draft !== req.content;

  return (
    <div className="appshell">
      <Header projectName={project.name} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="body">
        {sidebarOpen && (
          <ProjectSidebar projectId={project.id} projectName={project.name} active="requirements" />
        )}
        <main className="main">
          <div className="crumb">
            <Link href={`/projects/${project.id}/requirements`}>
              <b>요구사항</b>
            </Link>{" "}
            / {req.reqKey}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, fontFamily: "var(--mono)" }}>{req.reqKey}</h1>
            <span className="lbl" style={{ padding: "2px 11px", background: "var(--surface-muted)", color: "var(--muted)" }}>
              {req.stateLabel}
            </span>
            {req.version && <span className="tagv">🏷 v{req.version}</span>}
          </div>

          <div className="w2col" style={{ marginTop: 16, maxWidth: 1400 }}>
            {/* 왼쪽: AI 검토 결과 — 읽기 전용. 버튼(적용하기) 없음. */}
            <div className="wcard readonly">
              <div className="wch">
                🤖 AI 검토 결과
                <span className="rt">
                  <span className="lbl" style={{ padding: "1px 9px", background: "var(--surface-muted)", color: "var(--muted)" }}>
                    읽기 전용
                  </span>
                  <span className="lbl" style={{ padding: "1px 9px", marginLeft: 6, background: "var(--surface-muted)", color: "var(--muted)" }}>
                    {ENGINE_LABEL[req.aiEngine] ?? req.aiEngine}
                  </span>
                  <span className="cnt" style={{ marginLeft: 8 }}>
                    {req.findings.length}건
                  </span>
                  <button className="btn sm" style={{ marginLeft: 8 }} onClick={onReanalyze} disabled={reanalyzing}>
                    {reanalyzing ? "분석 중…" : "↻ 다시 분석"}
                  </button>
                </span>
              </div>
              <div className="wcb">
                {req.findings.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                    {req.aiEngine === "unavailable"
                      ? "AI 서버가 응답하지 않아 검토를 못 했습니다. “다시 분석”을 눌러보세요."
                      : "검출된 불명확·상충이 없습니다."}
                  </p>
                ) : (
                  req.findings.map((f, i) => (
                    <div
                      key={i}
                      className="find"
                      style={i === req.findings.length - 1 ? { marginBottom: 0 } : undefined}
                    >
                      <div className="ft">
                        <span className={`ftype2 ${isConflict(f.findingType) ? "cf" : "amb"}`}>{f.findingType}</span>
                        {f.targetSpan && <span className="fspan2">&ldquo;{f.targetSpan}&rdquo;</span>}
                      </div>
                      {f.reason && <div className="frs2">{f.reason}</div>}
                      {f.suggestion && (
                        <div className={isConflict(f.findingType) ? "fconf" : "aisuggest"}>
                          {isConflict(f.findingType) ? "⚠ " : "✎ 제안: "}
                          {f.suggestion}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 오른쪽: 확정될 본문 — AI 제안이 이미 반영된 상태로 채워져 있고, 여기서만 편집한다. */}
            <div className="wcard">
              <div className="wch">
                ✏️ 확정될 본문
                <span className="rt">
                  <span className="lbl blue" style={{ padding: "1px 9px" }}>
                    여기서만 편집
                  </span>
                </span>
              </div>
              <div className="wcb">
                {dirty ? (
                  <div className="prefill">
                    ⬇ 위 <b>AI 제안이 이미 반영된 상태</b>로 채워져 있습니다. 그대로 두거나 직접 고치세요.
                  </div>
                ) : (
                  <div className="prefill" style={{ background: "var(--surface-muted)", borderColor: "var(--line)", color: "var(--muted)" }}>
                    지금은 <b>등록 원문과 같습니다</b>. 자유롭게 고칠 수 있습니다.
                  </div>
                )}
                <textarea className="reqta" value={draft} onChange={(e) => setDraft(e.target.value)} />
                <div className="prefill-act">
                  <button className="btn sm" onClick={() => setDraft(req.content)} disabled={!dirty}>
                    ↩ 등록 원문으로 되돌리기
                  </button>
                  <span className="pf-orig">등록 원문: &ldquo;{req.content}&rdquo;</span>
                </div>
              </div>
            </div>
          </div>

          <div className="jf" style={{ maxWidth: 1400, marginTop: 16, borderBottom: "none", gap: 22, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
              <b style={{ color: "var(--muted)", fontWeight: 600 }}>요청자</b>{" "}
              {req.requesterDept ? `${req.requesterDept} · ` : ""}
              {req.requesterName ?? "—"}
            </span>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
              <b style={{ color: "var(--muted)", fontWeight: 600 }}>담당자</b> {req.assigneeName ?? "—"}
            </span>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
              <b style={{ color: "var(--muted)", fontWeight: 600 }}>등록일</b> {req.createdAt ?? "—"}
            </span>
          </div>

          <div className="placeholder" style={{ marginTop: 16, maxWidth: 1400 }}>
            고객 합의 기록과 확정(→ v1.0.0)은 다음 단계에서 구현됩니다.
          </div>
        </main>
      </div>
    </div>
  );
}
