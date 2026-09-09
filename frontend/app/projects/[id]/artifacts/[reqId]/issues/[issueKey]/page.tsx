"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ArtifactPills from "../../../../../../components/ArtifactPills";
import Header from "../../../../../../components/Header";
import ProjectSidebar from "../../../../../../components/ProjectSidebar";
import { mockIssueFor } from "../../../../../../lib/artifactsMock";
import {
  getProject,
  getRequirement,
  listDevIssues,
  type DevIssue,
  type ProjectDetail,
  type RequirementDetail,
} from "../../../../../../lib/api";
import { getCurrentUser } from "../../../../../../lib/session";

export default function IssueDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string; reqId: string; issueKey: string }>();
  const projectId = Number(params.id);
  const requirementId = Number(params.reqId);
  const issueKey = params.issueKey;

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

  const realIdx = issues.findIndex((i) => i.issueKey === issueKey);
  const issue = realIdx < 0 ? null : mockIssueFor(issues[realIdx], realIdx + 1);
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
          </div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "4px 0 18px" }}>
            {issue.key} · 담당자 {issue.assigneeName} · 모듈 {issue.module}
          </p>

          {/* 필드마다 AI/사람 배지를 붙이는 대신 한 번만 안내한다 — DESIGN.md 4.2:
              모든 항목을 AI가 초안으로 채우고, 사람은 그 위에서 검토·수정만 한다. */}
          <div className="aidraftnote" style={{ maxWidth: 900 }}>
            <span>🧩</span>
            <span>
              <b>전부 AI 초안입니다.</b> 아래 칸에 바로 고쳐 쓰세요 — 현재 시스템 상태처럼 AI가 실제로는
              모르는 항목(추정 표시된 것)은 특히 확인이 필요합니다. 지금은 틀(양식)만 제공하는 단계라 여기서
              고친 내용은 아직 저장되지 않습니다.
            </span>
          </div>

          <div className="wcard" style={{ maxWidth: 900 }}>
            <div className="wcb">
              <div className="catlbl">① 요구사항 접수</div>

              <div className="fieldlab" style={{ marginTop: 0 }}>
                현상 기록{issue.reception.phenomenonAssumed && <span className="aidraftassumed">추정 — 확인 필요</span>}
              </div>
              <textarea className="reqta" style={{ minHeight: 64 }} defaultValue={issue.reception.phenomenonText} />

              <div className="fieldlab">개선 요청사항</div>
              <textarea className="reqta" style={{ minHeight: 64 }} defaultValue={issue.reception.improvementRequest} />

              <div className="catlbl">② 요구사항 개발</div>

              <div className="fieldlab" style={{ marginTop: 0 }}>
                변경 범위{issue.development.changeScopeAssumed && <span className="aidraftassumed">추정 — 확인 필요</span>}
              </div>
              <textarea className="reqta" style={{ minHeight: 64 }} defaultValue={issue.development.changeScopeText} />

              <div className="fieldlab">제약 사항</div>
              <textarea className="reqta" style={{ minHeight: 64 }} defaultValue={issue.development.constraints} />

              <div className="catlbl">③ 변경점 설계</div>

              <div className="fieldlab" style={{ marginTop: 0 }}>
                변경 전 (As-Is){issue.changeDesign.beforeAssumed && <span className="aidraftassumed">추정 — 확인 필요</span>}
              </div>
              <textarea className="reqta" style={{ minHeight: 64 }} defaultValue={issue.changeDesign.before} />

              <div className="fieldlab">변경 후 (To-Be)</div>
              <textarea className="reqta" style={{ minHeight: 64 }} defaultValue={issue.changeDesign.after} />

              <div className="catlbl">날짜</div>
              <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
                <span>
                  <b style={{ color: "var(--muted)", fontWeight: 600 }}>기한</b> {issue.dueDate}
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
            산출물
          </div>
          <ArtifactPills base={artifactBase} large />
        </main>
      </div>
    </div>
  );
}
