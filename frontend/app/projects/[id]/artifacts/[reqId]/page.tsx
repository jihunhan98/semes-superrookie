"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AiFindings from "../../../../components/AiFindings";
import Header from "../../../../components/Header";
import ProjectSidebar from "../../../../components/ProjectSidebar";
import { mockIssueFor } from "../../../../lib/artifactsMock";
import {
  getProject,
  getRequirement,
  listDevIssues,
  type DevIssue,
  type ProjectDetail,
  type RequirementDetail,
} from "../../../../lib/api";
import { getCurrentUser } from "../../../../lib/session";

export default function ArtifactsTreePage() {
  const router = useRouter();
  const params = useParams<{ id: string; reqId: string }>();
  const projectId = Number(params.id);
  const requirementId = Number(params.reqId);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [req, setReq] = useState<RequirementDetail | null>(null);
  const [issues, setIssues] = useState<DevIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!Number.isFinite(projectId) || !Number.isFinite(requirementId)) return;

    Promise.all([
      getProject(projectId, user.id),
      getRequirement(projectId, requirementId, user.id),
      listDevIssues(projectId, requirementId, user.id),
    ])
      .then(([p, r, iss]) => {
        setProject(p);
        setReq(r);
        setIssues(iss);
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

  if (!project || !req || !issues) {
    return (
      <div className="appshell">
        <Header />
        <main className="main">
          <div className="placeholder">불러오는 중…</div>
        </main>
      </div>
    );
  }

  // 산출물 내용 자체는 아직 UI만 있어 목업으로 채운다 — 이슈(key·title·구절)만 실제 값.
  const mockIssues = issues.map((issue, i) => mockIssueFor(issue, i + 1));

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

          {issues.length === 0 ? (
            <div className="wcard" style={{ marginTop: 16, maxWidth: 900, borderColor: "var(--purple)" }}>
              <div className="wcb" style={{ textAlign: "center", padding: "28px 16px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                  🧩 아직 개발 이슈로 나누지 않았습니다
                </div>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>
                  AI가 이슈 경계를 제안하면, 합치기·나누기·제목 수정으로 다듬은 뒤 확정합니다.
                  확정한 이슈마다 산출물 4종(SWVOC·기능·비기능 요구사항·Detail Design)이 함께 붙습니다.
                </p>
                <Link className="btn prim" href={`/projects/${project.id}/artifacts/${requirementId}/split`}>
                  🧩 이슈 나누기 시작
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="artbanner" style={{ marginTop: 16 }}>
                <span className="aico">🧩</span>
                <div className="att">개발 이슈 {issues.length}건으로 나눴습니다.</div>
                <Link
                  className="btn sm"
                  style={{ marginLeft: "auto" }}
                  href={`/projects/${project.id}/artifacts/${requirementId}/split`}
                >
                  ✎ 이슈 나누기 수정
                </Link>
              </div>

              <div className="arttree" style={{ marginTop: 18 }}>
                {mockIssues.map((issue) => (
                  <div key={issue.key}>
                    <Link
                      className="irow"
                      href={`/projects/${project.id}/artifacts/${requirementId}/issues/${issue.key}`}
                    >
                      🔖 개발 이슈 <span className="ikey">{issue.key}</span> {issue.title}
                      <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                        <span className="aitag">🤖 산출물 UI 목업</span>
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
            </>
          )}
        </main>
      </div>
    </div>
  );
}
