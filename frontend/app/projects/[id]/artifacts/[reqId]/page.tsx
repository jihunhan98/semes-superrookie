"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AiFindings from "../../../../components/AiFindings";
import Header from "../../../../components/Header";
import ProjectSidebar from "../../../../components/ProjectSidebar";
import { buildMockIssues } from "../../../../lib/artifactsMock";
import { getProject, getRequirement, type ProjectDetail, type RequirementDetail } from "../../../../lib/api";
import { getCurrentUser } from "../../../../lib/session";

export default function ArtifactsTreePage() {
  const router = useRouter();
  const params = useParams<{ id: string; reqId: string }>();
  const projectId = Number(params.id);
  const requirementId = Number(params.reqId);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [req, setReq] = useState<RequirementDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [redoing, setRedoing] = useState(false);
  const [showRedoForm, setShowRedoForm] = useState(false);
  const [redoPrompt, setRedoPrompt] = useState("");

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
      })
      .catch((err) => setError(err instanceof Error ? err.message : "요구사항을 불러오지 못했습니다."));
  }, [projectId, requirementId, router]);

  /** 아직 재도출 로직은 없다 — 로딩만 잠깐 보여주고 프롬프트 입력창을 닫는다. */
  function onRedo() {
    setRedoing(true);
    setTimeout(() => {
      setRedoing(false);
      setShowRedoForm(false);
      setRedoPrompt("");
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

  const issues = buildMockIssues();

  return (
    <div className="appshell">
      <Header projectName={project.name} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="body">
        {sidebarOpen && <ProjectSidebar projectId={project.id} projectName={project.name} active="artifacts" />}
        <main className="main">
          <div className="crumb">
            <Link href={`/projects/${project.id}/artifacts`}>
              <b>산출물</b>
            </Link>{" "}
            / {req.reqKey}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{req.reqKey} 산출물 도출</h1>
            <span className="tagv">🏷 v{req.version}</span>
          </div>

          <div className="wcard readonly" style={{ marginTop: 16, maxWidth: 900 }}>
            <div className="wch">
              📄 확정본
              <span className="rt">
                <span className="tagv">v{req.version}</span>
              </span>
            </div>
            <div className="wcb">
              <AiFindings
                content={req.content}
                findings={req.findings}
                contentLabel={`확정본 v${req.version}`}
                empty="검출된 불명확·상충이 없습니다."
              />
            </div>
          </div>

          <div className="artbanner" style={{ marginTop: 16 }}>
            <span className="aico">🤖</span>
            <div className="att">개발 이슈 {issues.length}건을 생성했습니다.</div>
            <button
              className="btn sm"
              style={{ marginLeft: "auto" }}
              onClick={() => setShowRedoForm((v) => !v)}
              disabled={redoing}
            >
              ↻ 재도출
            </button>
          </div>

          {showRedoForm && (
            <div className="wcard" style={{ marginTop: 10, maxWidth: 900 }}>
              <div className="wcb">
                <div className="fieldlab" style={{ marginTop: 0 }}>
                  AI에게 물어보기 <span style={{ fontWeight: 400, color: "var(--faint)", fontSize: 11.5 }}>· 선택 입력</span>
                </div>
                <textarea
                  className="reqta"
                  style={{ minHeight: 64 }}
                  value={redoPrompt}
                  onChange={(e) => setRedoPrompt(e.target.value)}
                  placeholder="예: 우선순위 기준을 SoC 대신 배터리 잔량 그대로 써서 다시 나눠줘."
                />
                <div className="wfoot">
                  <button className="btn prim" onClick={onRedo} disabled={redoing}>
                    {redoing ? "재도출 중…" : "재도출 실행"}
                  </button>
                  <button className="btn" onClick={() => setShowRedoForm(false)} disabled={redoing}>
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="arttree" style={{ marginTop: 18 }}>
            {issues.map((issue) => (
              <div key={issue.key}>
                <Link
                  className="irow"
                  href={`/projects/${project.id}/artifacts/${requirementId}/issues/${issue.key}`}
                >
                  🔖 개발 이슈 <span className="ikey">{issue.key}</span> {issue.title}
                  <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="aitag">🤖 AI 초안</span>
                    <span
                      className="lbl"
                      style={{
                        padding: "2px 10px",
                        background: issue.state === "완료" ? "var(--green-soft)" : "var(--surface-muted)",
                        color: issue.state === "완료" ? "var(--green)" : "var(--muted)",
                      }}
                    >
                      {issue.state}
                    </span>
                  </span>
                </Link>
                <div className="abranch">
                  <Link
                    className="arow"
                    style={{ borderLeftColor: "var(--red)" }}
                    href={`/projects/${project.id}/artifacts/${requirementId}/issues/${issue.key}/voc`}
                  >
                    <span className="aicon">🗣</span>
                    <span className="atxt">SWVOC — {issue.voc.request.slice(0, 24)}…</span>
                    <span className="achev">열기 ›</span>
                  </Link>
                  <Link
                    className="arow"
                    style={{ borderLeftColor: "var(--purple)" }}
                    href={`/projects/${project.id}/artifacts/${requirementId}/issues/${issue.key}/functional`}
                  >
                    <span className="aicon">⚙</span>
                    <span className="atxt">기능 요구사항 — {issue.title}</span>
                    <span className="achev">열기 ›</span>
                  </Link>
                  <Link
                    className="arow"
                    style={{ borderLeftColor: "var(--green)" }}
                    href={`/projects/${project.id}/artifacts/${requirementId}/issues/${issue.key}/nonfunctional`}
                  >
                    <span className="aicon">🛡</span>
                    <span className="atxt">비기능 요구사항 — {issue.nonFunctional.role.slice(0, 20)}…</span>
                    <span className="achev">열기 ›</span>
                  </Link>
                  <Link
                    className="arow"
                    style={{ borderLeftColor: "var(--accent)" }}
                    href={`/projects/${project.id}/artifacts/${requirementId}/issues/${issue.key}/detail-design`}
                  >
                    <span className="aicon">📐</span>
                    <span className="atxt">Detail Design — {issue.title}</span>
                    <span className="achev">열기 ›</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
