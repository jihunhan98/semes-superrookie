"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../../../../components/Header";
import ProjectSidebar from "../../../../../../components/ProjectSidebar";
import { findMockIssue } from "../../../../../../lib/artifactsMock";
import { getProject, getRequirement, type ProjectDetail, type RequirementDetail } from "../../../../../../lib/api";
import { getCurrentUser } from "../../../../../../lib/session";

export default function IssueDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string; reqId: string; issueKey: string }>();
  const projectId = Number(params.id);
  const requirementId = Number(params.reqId);
  const issueKey = params.issueKey;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [req, setReq] = useState<RequirementDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

  const issue = findMockIssue(issueKey);
  if (!issue) {
    return (
      <div className="appshell">
        <Header projectName={project.name} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <div className="body">
          {sidebarOpen && <ProjectSidebar projectId={project.id} projectName={project.name} active="artifacts" />}
          <main className="main">
            <p className="lmsg err">이슈를 찾을 수 없습니다.</p>
          </main>
        </div>
      </div>
    );
  }

  const artifactBase = `/projects/${project.id}/artifacts/${requirementId}/issues/${issue.key}`;

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
            / <Link href={`/projects/${project.id}/artifacts/${requirementId}`}>{req.reqKey}</Link> / {issue.key}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{issue.title}</h1>
            <span
              className="lbl"
              style={{ padding: "2px 11px", background: "var(--surface-muted)", color: "var(--muted)" }}
            >
              {issue.state}
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "4px 0 18px" }}>
            {issue.key} · 담당자 {issue.assigneeName} · 모듈 {issue.module}
          </p>

          <div className="wcard" style={{ maxWidth: 900 }}>
            <div className="wcb">
              <div className="catlbl">① 요구사항 접수</div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <b style={{ fontSize: 13 }}>현상 기록</b>
                <span className="humantag">🖊 사람 작성 필요</span>
              </div>
              <div className="humanbox">🖊 현재 시스템의 동작·문제 상황은 담당자가 관찰해 기록합니다. AI가 알 수 없는 영역이라 빈칸입니다.</div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 8px" }}>
                <b style={{ fontSize: 13 }}>개선 요청사항</b>
                <span className="aitag">🤖 AI 도출</span>
              </div>
              <div className="wcard readonly">
                <div className="wcb" style={{ fontSize: 13.5 }}>{issue.reception.improvementRequest}</div>
              </div>

              <div className="catlbl">② 요구사항 개발</div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <b style={{ fontSize: 13 }}>변경 범위</b>
                <span className="humantag">🖊 사람 작성 필요</span>
              </div>
              <div className="humanbox">🖊 어떤 모듈·DB까지 손대는지는 현재 코드 구조를 아는 담당자가 지정합니다.</div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 8px" }}>
                <b style={{ fontSize: 13 }}>제약 사항</b>
                <span className="aitag">🤖 AI 도출</span>
              </div>
              <div className="wcard readonly">
                <div className="wcb" style={{ fontSize: 13.5 }}>{issue.development.constraints}</div>
              </div>

              <div className="catlbl">③ 변경점 설계</div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <b style={{ fontSize: 13 }}>변경 전 (As-Is)</b>
                <span className="humantag">🖊 사람 작성 필요</span>
              </div>
              <div className="humanbox">
                🖊 {issue.changeDesign.before ?? "기존 로직의 현재 구현은 담당자가 코드를 확인해 기술합니다."}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 8px" }}>
                <b style={{ fontSize: 13 }}>변경 후 (To-Be)</b>
                <span className="aitag">🤖 AI 도출</span>
              </div>
              <div className="wcard readonly">
                <div className="wcb" style={{ fontSize: 13.5 }}>{issue.changeDesign.after}</div>
              </div>

              <div className="catlbl">날짜</div>
              <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
                <span>
                  <b style={{ color: "var(--muted)", fontWeight: 600 }}>기한</b>{" "}
                  <span className="humantag" style={{ marginRight: 6 }}>
                    🖊
                  </span>
                  {issue.dueDate}
                </span>
                <span>
                  <b style={{ color: "var(--muted)", fontWeight: 600 }}>생성일</b> {issue.createdAt} · 자동
                </span>
                <span>
                  <b style={{ color: "var(--muted)", fontWeight: 600 }}>해결일</b>{" "}
                  {issue.resolvedAt ?? "미해결 · 자동 기록 예정"}
                </span>
              </div>
            </div>
          </div>

          <div className="fieldlab" style={{ marginTop: 22 }}>
            하위 작업 (산출물 4종)
          </div>
          <div className="arttree" style={{ maxWidth: 900 }}>
            <Link className="irow" style={{ borderLeftColor: "var(--red)" }} href={`${artifactBase}/voc`}>
              🗣 SWVOC — {issue.voc.key}
              <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <span className="aitag">🤖 AI</span>
                <span className="lbl" style={{ padding: "2px 10px", background: "var(--surface-muted)", color: "var(--muted)" }}>
                  {issue.voc.state}
                </span>
              </span>
            </Link>
            <Link className="irow" href={`${artifactBase}/functional`}>
              ⚙ 기능 요구사항 — {issue.functional.key}
              <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <span className="aitag">🤖 AI</span>
                <span className="lbl" style={{ padding: "2px 10px", background: "var(--surface-muted)", color: "var(--muted)" }}>
                  {issue.functional.state}
                </span>
              </span>
            </Link>
            <Link className="irow" style={{ borderLeftColor: "var(--green)" }} href={`${artifactBase}/nonfunctional`}>
              🛡 비기능 요구사항 — {issue.nonFunctional.key}
              <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <span className="aitag">🤖 AI</span>
                <span className="lbl" style={{ padding: "2px 10px", background: "var(--surface-muted)", color: "var(--muted)" }}>
                  {issue.nonFunctional.state}
                </span>
              </span>
            </Link>
            <Link className="irow" style={{ borderLeftColor: "var(--accent)" }} href={`${artifactBase}/detail-design`}>
              📐 Detail Design — {issue.detailDesign.key}
              <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <span className="aitag">🤖 AI</span>
                <span
                  className="lbl"
                  style={{
                    padding: "2px 10px",
                    background: issue.detailDesign.state === "확정" ? "var(--green-soft)" : "var(--surface-muted)",
                    color: issue.detailDesign.state === "확정" ? "var(--green)" : "var(--muted)",
                  }}
                >
                  {issue.detailDesign.state}
                </span>
              </span>
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
