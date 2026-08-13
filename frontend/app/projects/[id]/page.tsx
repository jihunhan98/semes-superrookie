"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "../../components/Header";
import ProjectSidebar from "../../components/ProjectSidebar";
import { getProject, type ProjectDetail } from "../../lib/api";
import { getCurrentUser } from "../../lib/session";

export default function ProjectHomePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!Number.isFinite(projectId)) return;
    getProject(projectId, user.id)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : "프로젝트를 불러오지 못했습니다."));
  }, [projectId, router]);

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

  if (!detail) {
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
      <Header projectName={detail.name} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="body">
        {sidebarOpen && <ProjectSidebar projectId={detail.id} projectName={detail.name} active="home" />}
        <main className="main">
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{detail.name}</h1>
          {detail.customer && <p className="psub" style={{ marginBottom: 4 }}>{detail.customer}</p>}
          {detail.description && (
            <p style={{ color: "var(--muted)", fontSize: 14, maxWidth: 640 }}>{detail.description}</p>
          )}

          <div className="pmeta" style={{ fontSize: 13, margin: "18px 0 24px" }}>
            <span>
              내 역할 <b>{detail.role === "OWNER" ? "Owner" : "Member"}</b>
            </span>
            <span style={{ marginLeft: 18 }}>
              멤버 <b>{detail.members.length}</b>
            </span>
          </div>

          <div className="placeholder">요구사항·산출물·추적성 기능은 준비 중입니다.</div>
        </main>
      </div>
    </div>
  );
}
