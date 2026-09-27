"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Header from "../../components/Header";
import ProjectSidebar from "../../components/ProjectSidebar";
import MembersCard from "../../components/MembersCard";
import { getProject, listRequirements, type ProjectDetail, type RequirementSummary } from "../../lib/api";
import { getCurrentUser } from "../../lib/session";

export default function ProjectHomePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [requirements, setRequirements] = useState<RequirementSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!Number.isFinite(projectId)) return;
    Promise.all([getProject(projectId, user.id), listRequirements(projectId, user.id)])
      .then(([project, rows]) => { setDetail(project); setRequirements(rows); })
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

  if (!detail || !requirements) {
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
  const confirmed = requirements.filter((item) => item.state === "CONFIRMED").length;
  const inProgress = requirements.length - confirmed;
  const needsAttention = requirements.filter((item) => item.findingCount > 0).length;

  return (
    <div className="appshell">
      <Header projectName={detail.name} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="body">
        {sidebarOpen && <ProjectSidebar projectId={detail.id} projectName={detail.name} active="home" />}
        <main className="main project-overview">
          <section className="project-hero">
            <div>
              <span className="section-kicker">PROJECT OVERVIEW</span>
              <div className="project-title-line">
                <h1>{detail.name}</h1>
                <span className={`role ${isOwner ? "own" : "mem"}`}>{isOwner ? "Owner" : "Member"}</span>
              </div>
              <p>{detail.description || "요구사항과 개발 산출물을 추적 가능한 흐름으로 관리합니다."}</p>
              {detail.customer && <span className="customer-pill">고객사 · {detail.customer}</span>}
            </div>
            <Link className="btn prim" href={`/projects/${detail.id}/requirements/new`}>＋ 요구사항 등록</Link>
          </section>

          <section className="metric-grid" aria-label="프로젝트 현황">
            <Link href={`/projects/${detail.id}/requirements`} className="metric-card">
              <span>전체 요구사항</span><b>{requirements.length}</b><small>전체 목록 보기 →</small>
            </Link>
            <div className="metric-card blue"><span>진행 중</span><b>{inProgress}</b><small>합의·검토 진행</small></div>
            <div className="metric-card green"><span>확정 완료</span><b>{confirmed}</b><small>버전 고정됨</small></div>
            <div className="metric-card amber"><span>확인 필요</span><b>{needsAttention}</b><small>AI 검출 항목 있음</small></div>
          </section>

          <section className="project-workflow-card">
            <div className="section-heading compact">
              <div><span className="section-kicker">ACTIVE FLOW</span><h2>요구사항 처리 흐름</h2></div>
              <Link href={`/projects/${detail.id}/requirements`}>전체 요구사항 →</Link>
            </div>
            <div className="project-flow">
              <div><span>1</span><b>등록</b><small>원문 저장</small></div>
              <i>→</i>
              <div><span>2</span><b>검출·합의</b><small>고객 확인</small></div>
              <i>→</i>
              <div><span>3</span><b>도출</b><small>이슈·산출물</small></div>
              <i>→</i>
              <div><span>4</span><b>검토·확정</b><small>이력 고정</small></div>
            </div>
          </section>

          <div className="project-info-grid">
            <div className="setcard">
              <div className="seth">프로젝트 정보</div>
              <div className="setb">
                <div className="frow"><span className="k">프로젝트명</span><span>{detail.name}</span></div>
                <div className="frow"><span className="k">고객사</span><span>{detail.customer || "—"}</span></div>
                <div className="frow"><span className="k">설명</span><span>{detail.description || "—"}</span></div>
                {isOwner && <div style={{ marginTop: 12 }}><Link className="btn sm" href={`/projects/${detail.id}/settings`}>프로젝트 설정</Link></div>}
              </div>
            </div>
            <MembersCard projectId={detail.id} isOwner={isOwner} members={detail.members} initialToken={detail.token} />
          </div>
        </main>
      </div>
    </div>
  );
}
