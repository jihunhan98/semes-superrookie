"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Header from "../../components/Header";
import ProjectSidebar from "../../components/ProjectSidebar";
import MembersCard from "../../components/MembersCard";
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

  const isOwner = detail.role === "OWNER";

  return (
    <div className="appshell">
      <Header projectName={detail.name} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="body">
        {sidebarOpen && <ProjectSidebar projectId={detail.id} projectName={detail.name} active="home" />}
        <main className="main">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{detail.name}</h1>
            <span className={`role ${isOwner ? "own" : "mem"}`}>{isOwner ? "Owner" : "Member"}</span>
          </div>
          {detail.customer && <p className="psub" style={{ marginBottom: 4 }}>{detail.customer}</p>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 1000, marginTop: 18 }}>
            <div className="setcard">
              <div className="seth">🗂️ 기본 정보</div>
              <div className="setb">
                <div className="frow">
                  <span className="k">프로젝트명</span>
                  <span>{detail.name}</span>
                </div>
                <div className="frow">
                  <span className="k">고객사</span>
                  <span>{detail.customer || "—"}</span>
                </div>
                <div className="frow">
                  <span className="k">설명</span>
                  <span>{detail.description || "—"}</span>
                </div>
                {isOwner && (
                  <div style={{ marginTop: 12 }}>
                    <Link className="btn sm" href={`/projects/${detail.id}/settings`}>
                      설정에서 수정
                    </Link>
                  </div>
                )}
              </div>
            </div>

            <MembersCard projectId={detail.id} isOwner={isOwner} members={detail.members} initialToken={detail.token} />
          </div>

          <div className="placeholder" style={{ marginTop: 16, maxWidth: 1000 }}>
            요구사항·산출물·추적성 기능은 준비 중입니다.
          </div>
        </main>
      </div>
    </div>
  );
}
