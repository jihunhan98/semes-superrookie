"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../components/Header";
import ProjectSidebar from "../../../components/ProjectSidebar";
import {
  getProject,
  listRequirements,
  type ProjectDetail,
  type ReqState,
  type RequirementSummary,
} from "../../../lib/api";
import { getCurrentUser } from "../../../lib/session";

/** 요구사항 목록(화면 1)과 같은 상태 점 색. */
const STATE_COLOR: Record<ReqState, string> = {
  RECEIVED: "#9aa5b1",
  IN_REVIEW: "#d4a72c",
  PENDING_CONSENSUS: "#8250df",
  CONFIRMED: "#1f883d",
  REVISING: "#0969da",
  ON_HOLD: "#cf222e",
};

export default function ArtifactsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [rows, setRows] = useState<RequirementSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deriving, setDeriving] = useState<number | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!Number.isFinite(projectId)) return;

    Promise.all([getProject(projectId, user.id), listRequirements(projectId, user.id)])
      .then(([p, reqs]) => {
        setProject(p);
        setRows(reqs);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "요구사항을 불러오지 못했습니다."));
  }, [projectId, router]);

  /** 아직 도출 로직은 없다 — 로딩만 잠깐 보여주고 산출물 트리(목업)로 이동한다. */
  function onDerive(reqId: number) {
    setDeriving(reqId);
    setTimeout(() => {
      router.push(`/projects/${projectId}/artifacts/${reqId}`);
    }, 700);
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

  if (!project || !rows) {
    return (
      <div className="appshell">
        <Header />
        <main className="main">
          <div className="placeholder">불러오는 중…</div>
        </main>
      </div>
    );
  }

  return (
    <div className="appshell">
      <Header projectName={project.name} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="body">
        {sidebarOpen && <ProjectSidebar projectId={project.id} projectName={project.name} active="artifacts" />}
        <main className="main">
          <div className="rqtoolbar">
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
              산출물 도출 <span style={{ color: "var(--muted)", fontWeight: 600, fontSize: 16 }}>{rows.length}</span>
            </h1>
          </div>

          {rows.length === 0 ? (
            <div className="placeholder">아직 등록된 요구사항이 없습니다.</div>
          ) : (
            <div className="rqlist">
              {rows.map((r) => (
                <div key={r.id} className="rqrow">
                  <span className="sdot" style={{ background: STATE_COLOR[r.state] }} />
                  <span className="rmid">{r.reqKey}</span>
                  <span className="rtit">{r.content}</span>
                  <span className="rt">
                    {r.version ? (
                      <span className="tagv">🏷 v{r.version}</span>
                    ) : (
                      <span
                        className="lbl"
                        style={{ padding: "1px 9px", background: "var(--surface-muted)", color: "var(--muted)" }}
                      >
                        {r.stateLabel}
                      </span>
                    )}
                    <span className="rasg">{r.assigneeName ?? "—"}</span>
                    {r.state === "CONFIRMED" ? (
                      <button
                        className="btn prim sm"
                        onClick={() => onDerive(r.id)}
                        disabled={deriving !== null}
                      >
                        {deriving === r.id ? "도출 중…" : "🤖 도출"}
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--faint)", width: 78, textAlign: "right" }}>
                        확정 후 가능
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
