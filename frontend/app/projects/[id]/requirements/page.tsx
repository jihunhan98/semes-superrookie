"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../components/Header";
import ProjectSidebar from "../../../components/ProjectSidebar";
import {
  getProject,
  listAssignees,
  listRequirements,
  type AssigneeCandidate,
  type ProjectDetail,
  type ReqState,
  type RequirementSummary,
} from "../../../lib/api";
import { getCurrentUser } from "../../../lib/session";

/** 상태별 점 색 — 화면정의서의 상태값 5단계와 같은 색을 쓴다. */
const STATE_COLOR: Record<ReqState, string> = {
  RECEIVED: "#9aa5b1",
  IN_REVIEW: "#d4a72c",
  PENDING_CONSENSUS: "#8250df",
  CONFIRMED: "#1f883d",
  REVISING: "#0969da",
  ON_HOLD: "#cf222e",
};

type StateFilter = "ALL" | "OPEN" | "CONFIRMED";

function workflowStage(row: RequirementSummary) {
  if (row.state === "CONFIRMED") return { number: 3, label: "도출 준비" };
  if (row.state === "RECEIVED") return { number: 1, label: "등록" };
  return { number: 2, label: "검출·합의" };
}

export default function RequirementListPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [rows, setRows] = useState<RequirementSummary[] | null>(null);
  const [assignees, setAssignees] = useState<AssigneeCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 담당자 필터 — 아무도 선택하지 않으면 전체를 보여준다(OR 조건).
  const [picked, setPicked] = useState<number[]>([]);
  const [stateFilter, setStateFilter] = useState<StateFilter>("ALL");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!Number.isFinite(projectId)) return;

    Promise.all([
      getProject(projectId, user.id),
      listRequirements(projectId, user.id),
      listAssignees(projectId, user.id),
    ])
      .then(([p, reqs, people]) => {
        setProject(p);
        setRows(reqs);
        setAssignees(people);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "요구사항을 불러오지 못했습니다."));
  }, [projectId, router]);

  function toggleAssignee(userId: number) {
    setPicked((prev) => (prev.includes(userId) ? prev.filter((v) => v !== userId) : [...prev, userId]));
  }

  const visible = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      // 아무도 선택 안 했으면 전체 통과, 선택했으면 그중 하나라도 맞으면 통과(OR).
      if (picked.length > 0 && (r.assigneeId === null || !picked.includes(r.assigneeId))) return false;
      if (stateFilter === "CONFIRMED" && r.state !== "CONFIRMED") return false;
      if (stateFilter === "OPEN" && r.state === "CONFIRMED") return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const hay = `${r.reqKey} ${r.content} ${r.assigneeName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, picked, stateFilter, query]);

  const counts = useMemo(() => {
    const all = rows?.length ?? 0;
    const confirmed = rows?.filter((r) => r.state === "CONFIRMED").length ?? 0;
    return { all, confirmed, open: all - confirmed };
  }, [rows]);

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

  return (
    <div className="appshell">
      <Header projectName={project.name} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="body">
        {sidebarOpen && (
          <ProjectSidebar projectId={project.id} projectName={project.name} active="requirements" />
        )}
        <main className="main requirements-main">
          <section className="requirements-hero">
            <div>
              <span className="section-kicker">REQUIREMENT PIPELINE</span>
              <h1>요구사항</h1>
              <p>등록 원문, AI 검출, 고객 합의와 확정 버전을 한 목록에서 추적합니다.</p>
            </div>
            <Link className="btn prim" href={`/projects/${project.id}/requirements/new`}>
              ＋ 새 요구사항
            </Link>
          </section>

          <section className="requirement-metrics" aria-label="요구사항 현황">
            <div><span>전체</span><b>{counts.all}</b></div>
            <div><span>진행 중</span><b>{counts.open}</b></div>
            <div><span>확정</span><b>{counts.confirmed}</b></div>
            <div><span>AI 확인 항목</span><b>{rows.reduce((sum, row) => sum + row.findingCount, 0)}</b></div>
          </section>

          <div className="rqbar">
            <div className="seg">
              <button className={stateFilter === "ALL" ? "on" : ""} onClick={() => setStateFilter("ALL")}>
                전체
              </button>
              <button className={stateFilter === "OPEN" ? "on" : ""} onClick={() => setStateFilter("OPEN")}>
                진행중 {counts.open}
              </button>
              <button
                className={stateFilter === "CONFIRMED" ? "on" : ""}
                onClick={() => setStateFilter("CONFIRMED")}
              >
                확정 {counts.confirmed}
              </button>
            </div>
            <input
              className="srch"
              placeholder="🔍 ID·내용·담당자로 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {assignees.length > 0 && (
            <div className="memfilter">
              <span className="mf-l">담당자</span>
              {assignees.map((a) => (
                <button
                  key={a.userId}
                  className={`mf-chip${picked.includes(a.userId) ? " on" : ""}`}
                  onClick={() => toggleAssignee(a.userId)}
                >
                  <span className="ck">✓</span>
                  {a.name}
                </button>
              ))}
              <span className="mf-note">
                {picked.length === 0 ? (
                  <>아무도 선택하지 않아 전체를 보여줍니다</>
                ) : (
                  <>
                    {picked.length}명 선택 · <b>OR</b>로 필터링
                  </>
                )}
              </span>
            </div>
          )}

          {visible.length === 0 ? (
            <div className="placeholder">
              {rows.length === 0
                ? "아직 등록된 요구사항이 없습니다. “＋ 새 요구사항”으로 첫 요구사항을 등록해보세요."
                : "조건에 맞는 요구사항이 없습니다."}
            </div>
          ) : (
            <div className="rqlist">
              {visible.map((r) => (
                <Link
                  key={r.id}
                  className="rqrow"
                  href={`/projects/${project.id}/requirements/${r.id}`}
                >
                  <span className="sdot" style={{ background: STATE_COLOR[r.state] }} />
                  <span className="rq-stage">
                    <b>{workflowStage(r).number}</b>
                    {workflowStage(r).label}
                  </span>
                  <span className="rmid">{r.reqKey}</span>
                  <span className="rtit">{r.content}</span>
                  <span className="rt">
                    {r.version ? (
                      <span className="tagv">🏷 v{r.version}</span>
                    ) : (
                      <span className="lbl" style={{ padding: "1px 9px", background: "var(--surface-muted)", color: "var(--muted)" }}>
                        {r.stateLabel}
                        {r.findingCount > 0 && ` · 검출 ${r.findingCount}`}
                      </span>
                    )}
                    <span className="rasg">{r.assigneeName ?? "—"}</span>
                    <span className="rup">{r.updatedAt ?? ""}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
