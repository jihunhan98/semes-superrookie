"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import { listProjects, type ProjectSummary } from "../lib/api";
import { getCurrentUser } from "../lib/session";
import { colorFor } from "../lib/colors";

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    listProjects(user.id)
      .then(setProjects)
      .catch((err) => setError(err instanceof Error ? err.message : "프로젝트 목록을 불러오지 못했습니다."));
  }, [router]);

  return (
    <div className="appshell">
      <Header />
      <main className="main dashboard-main">
        <section className="dashboard-hero">
          <div>
            <span className="section-kicker">WORKSPACE</span>
            <h1>요구사항 운영을 시작하세요</h1>
            <p>고객 원문부터 합의, 개발 이슈와 산출물 확정까지 하나의 이력으로 관리합니다.</p>
          </div>
          <div className="dashboard-actions">
            <Link className="btn prim" href="/projects/new">＋ 새 프로젝트</Link>
            <Link className="btn" href="/projects/open">참여 코드로 열기</Link>
          </div>
        </section>

        <section className="dashboard-guide" aria-label="업무 흐름 안내">
          <div><span>01</span><b>요구사항 등록</b><small>원문과 요청자 보존</small></div>
          <div><span>02</span><b>검출·고객 합의</b><small>모호성 확인과 확정</small></div>
          <div><span>03</span><b>개발 항목 도출</b><small>이슈와 산출물 자동 준비</small></div>
          <div><span>04</span><b>검토·전체 확정</b><small>근거와 버전 이력 고정</small></div>
        </section>

        <div className="section-heading">
          <div>
            <span className="section-kicker">MY PROJECTS</span>
            <h2>참여 프로젝트</h2>
          </div>
          {projects && <span className="section-count">{projects.length}</span>}
        </div>

        {error && <p className="lmsg err">{error}</p>}

        {!error && projects === null && <div className="placeholder">불러오는 중…</div>}

        {projects !== null && projects.length === 0 && (
          <div className="empty-workspace">
            <b>첫 프로젝트를 만들어보세요</b>
            <span>새 프로젝트를 만들거나 참여 코드로 기존 프로젝트에 들어갈 수 있습니다.</span>
            <Link className="btn prim" href="/projects/new">새 프로젝트 만들기</Link>
          </div>
        )}

        {projects !== null && projects.length > 0 && (
          <div className="pjgrid">
            {projects.map((p) => (
              <Link key={p.id} className="pjc" href={`/projects/${p.id}`}>
                <span className="pic" style={{ background: colorFor(p.name) }}>
                  {p.name.slice(0, 2)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="pnm">{p.name}</span>
                    <span className={`role ${p.role === "OWNER" ? "own" : "mem"}`}>
                      {p.role === "OWNER" ? "Owner" : "Member"}
                    </span>
                  </div>
                  {p.customer && <div className="pcust">{p.customer}</div>}
                  <div className="pmeta">
                    <span>
                      멤버 <b>{p.memberCount}</b>
                    </span>
                    <span className="project-open">프로젝트 열기 →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
