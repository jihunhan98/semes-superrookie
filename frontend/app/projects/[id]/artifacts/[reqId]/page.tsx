"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  const artifactCount = issues.length * 4;
  const doneCount = issues.filter((i) => i.state === "완료").length;

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
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4, marginBottom: 18 }}>{req.content}</p>

          <div className="artbanner">
            <span className="aico">🤖</span>
            <div>
              <div className="att">AI 도출 완료. 개발 이슈 {issues.length}건과 산출물 {artifactCount}건을 초안으로 생성했습니다.</div>
              <div className="ads">사람은 내용을 확인·보완한 뒤 확정합니다 · 방금 전 · 한지훈</div>
            </div>
            <button
              className="btn sm"
              style={{ marginLeft: "auto" }}
              onClick={() => setRedoing(true)}
              disabled={redoing}
            >
              {redoing ? "재도출 중…" : "↻ 재도출"}
            </button>
          </div>

          <div className="artstats">
            <div className="artstat">
              <div className="num">1</div>
              <div className="lb">요구사항</div>
            </div>
            <div className="artstat">
              <div className="num">{issues.length}</div>
              <div className="lb">개발 이슈 · AI 초안</div>
            </div>
            <div className="artstat">
              <div className="num">{artifactCount}</div>
              <div className="lb">산출물 · AI 초안</div>
            </div>
            <div className="artstat">
              <div className="num">{doneCount}</div>
              <div className="lb">확정 완료</div>
            </div>
          </div>

          <div className="arttree">
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
                    href={`/projects/${project.id}/artifacts/${requirementId}/issues/${issue.key}/voc`}
                  >
                    🗣 SWVOC — {issue.voc.request.slice(0, 24)}…
                  </Link>
                  <Link
                    className="arow"
                    href={`/projects/${project.id}/artifacts/${requirementId}/issues/${issue.key}/functional`}
                  >
                    ⚙ 기능 요구사항 — {issue.title}
                  </Link>
                  <Link
                    className="arow"
                    href={`/projects/${project.id}/artifacts/${requirementId}/issues/${issue.key}/nonfunctional`}
                  >
                    🛡 비기능 요구사항 — {issue.nonFunctional.role.slice(0, 20)}…
                  </Link>
                  <Link
                    className="arow"
                    href={`/projects/${project.id}/artifacts/${requirementId}/issues/${issue.key}/detail-design`}
                  >
                    📐 Detail Design — {issue.title}
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
