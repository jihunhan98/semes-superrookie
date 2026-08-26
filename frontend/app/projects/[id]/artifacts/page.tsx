"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../components/Header";
import ProjectSidebar from "../../../components/ProjectSidebar";
import { getProject, listRequirements, type ProjectDetail, type RequirementSummary } from "../../../lib/api";
import { getCurrentUser } from "../../../lib/session";

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

  const confirmed = rows.filter((r) => r.state === "CONFIRMED");

  return (
    <div className="appshell">
      <Header projectName={project.name} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="body">
        {sidebarOpen && <ProjectSidebar projectId={project.id} projectName={project.name} active="artifacts" />}
        <main className="main">
          <div className="rqtoolbar">
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>산출물 도출</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -6, marginBottom: 18 }}>
            확정된 요구사항에서 개발 이슈와 산출물 4종(SWVOC·기능 요구사항·비기능 요구사항·Detail Design)을
            초안으로 뽑아냅니다. <b style={{ color: "var(--ink)" }}>지금은 화면 구성 확인용</b>이라 실제 AI
            분석 없이 예시 결과를 보여줍니다.
          </p>

          {confirmed.length === 0 ? (
            <div className="placeholder">
              확정된 요구사항이 없습니다. 산출물은 <b>확정된 요구사항</b>에서만 도출할 수 있습니다.
            </div>
          ) : (
            <div className="artreqlist">
              {confirmed.map((r) => (
                <div key={r.id} className="artreqrow">
                  <span className="rmid">{r.reqKey}</span>
                  <span className="rtit" style={{ flex: 1 }}>
                    {r.content}
                  </span>
                  <span className="tagv">🏷 v{r.version}</span>
                  <button
                    className="btn prim sm"
                    onClick={() => onDerive(r.id)}
                    disabled={deriving !== null}
                  >
                    {deriving === r.id ? "도출 중…" : "🤖 도출"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
