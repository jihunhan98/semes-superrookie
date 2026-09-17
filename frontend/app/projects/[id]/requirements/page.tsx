"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
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
type SortDir = "asc" | "desc";
const PAGE_SIZES = [10, 20, 30] as const;

/** URL의 ?a= 파라미터(쉼표로 구분된 담당자 id 목록)를 배열로 되돌린다. */
function parseAssigneeParam(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));
}

export default function RequirementListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const projectId = Number(params.id);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [rows, setRows] = useState<RequirementSummary[] | null>(null);
  const [assignees, setAssignees] = useState<AssigneeCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 검색·필터·정렬·페이지 상태 — 상세를 보고 돌아와도 그대로 유지되도록
  // 최초값을 URL 쿼리에서 읽어온다. 이후 상태가 바뀌면 URL도 같이 갱신한다.
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [stateFilter, setStateFilter] = useState<StateFilter>(
    () => (searchParams.get("state") as StateFilter) || "ALL",
  );
  const [picked, setPicked] = useState<number[]>(() => parseAssigneeParam(searchParams.get("a")));
  const [sortDir, setSortDir] = useState<SortDir>(() => (searchParams.get("sort") === "asc" ? "asc" : "desc"));
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get("page")) || 1));
  const [pageSize, setPageSize] = useState<number>(() => {
    const fromUrl = Number(searchParams.get("size"));
    return (PAGE_SIZES as readonly number[]).includes(fromUrl) ? fromUrl : 10;
  });

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

  // 상태가 바뀔 때마다 URL 쿼리로 반영한다(뒤로가기로 돌아와도 같은 목록 위치를 보게).
  useEffect(() => {
    const q = new URLSearchParams();
    if (query.trim()) q.set("q", query.trim());
    if (stateFilter !== "ALL") q.set("state", stateFilter);
    if (picked.length > 0) q.set("a", picked.join(","));
    if (sortDir === "asc") q.set("sort", "asc");
    if (page > 1) q.set("page", String(page));
    if (pageSize !== 10) q.set("size", String(pageSize));
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, stateFilter, picked, sortDir, page, pageSize]);

  function toggleAssignee(userId: number) {
    setPage(1);
    setPicked((prev) => (prev.includes(userId) ? prev.filter((v) => v !== userId) : [...prev, userId]));
  }

  const filtered = useMemo(() => {
    if (!rows) return [];
    const list = rows.filter((r) => {
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
    // updatedAt은 "yyyy-MM-dd HH:mm" 형식이라 문자열 비교로 시간 순서가 그대로 유지된다.
    const sorted = [...list].sort((a, b) => {
      const av = a.updatedAt ?? "";
      const bv = b.updatedAt ?? "";
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return sorted;
  }, [rows, picked, stateFilter, query, sortDir]);

  const counts = useMemo(() => {
    const all = rows?.length ?? 0;
    const confirmed = rows?.filter((r) => r.state === "CONFIRMED").length ?? 0;
    return { all, confirmed, open: all - confirmed };
  }, [rows]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const visible = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);
  const rangeStart = filtered.length === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(clampedPage * pageSize, filtered.length);

  function toggleSort() {
    setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
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
        <main className="main">
          <div className="rqtoolbar">
            <div>
              <h1 style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-0.5px", margin: "0 0 6px" }}>요구사항</h1>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13.5 }}>
                프로젝트의 요구사항을 한곳에서 검토하고 관리하세요. 총 {counts.all}건 · 확정 {counts.confirmed}건
              </p>
            </div>
          </div>

          <div className="rqbar">
            <input
              className="srch"
              placeholder="ID·내용·담당자로 검색"
              value={query}
              onChange={(e) => {
                setPage(1);
                setQuery(e.target.value);
              }}
            />
            <div className="seg">
              <button
                className={stateFilter === "ALL" ? "on" : ""}
                onClick={() => {
                  setPage(1);
                  setStateFilter("ALL");
                }}
              >
                전체
              </button>
              <button
                className={stateFilter === "OPEN" ? "on" : ""}
                onClick={() => {
                  setPage(1);
                  setStateFilter("OPEN");
                }}
              >
                진행중 {counts.open}
              </button>
              <button
                className={stateFilter === "CONFIRMED" ? "on" : ""}
                onClick={() => {
                  setPage(1);
                  setStateFilter("CONFIRMED");
                }}
              >
                확정 {counts.confirmed}
              </button>
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
              </div>
            )}
          </div>

          <div className="reqtable-wrap">
            <table className="reqtable" aria-label="요구사항 목록">
              <thead>
                <tr>
                  <th>요구사항 ID</th>
                  <th>내용</th>
                  <th>상태</th>
                  <th>버전</th>
                  <th>담당자</th>
                  <th>
                    <button type="button" className="sorthead" onClick={toggleSort}>
                      수정일 {sortDir === "asc" ? "▲" : "▼"}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="rempty">
                      {rows.length === 0
                        ? "아직 등록된 요구사항이 없습니다. “＋ 새 요구사항”으로 첫 요구사항을 등록해보세요."
                        : "조건에 맞는 요구사항이 없습니다."}
                    </td>
                  </tr>
                ) : (
                  visible.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => router.push(`/projects/${project.id}/requirements/${r.id}`)}
                    >
                      <td>
                        <Link className="rid" href={`/projects/${project.id}/requirements/${r.id}`}>
                          {r.reqKey}
                        </Link>
                      </td>
                      <td className="rcontent" title={r.content}>
                        {r.content}
                      </td>
                      <td>
                        <span className="rstate">
                          <span className="sdot" style={{ background: STATE_COLOR[r.state] }} />
                          {r.stateLabel}
                          {r.findingCount > 0 && <span className="rfinding">검출 {r.findingCount}</span>}
                        </span>
                      </td>
                      <td className={r.version ? "" : "rmuted"}>{r.version ? `v${r.version}` : "—"}</td>
                      <td className={r.assigneeName ? "" : "rmuted"}>{r.assigneeName ?? "—"}</td>
                      <td className="rmuted">{r.updatedAt ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="pager">
            <span className="prange">
              전체 {filtered.length}개 중 {rangeStart}–{rangeEnd} 표시
            </span>
            <label className="psize">
              페이지당 행 수
              <select
                value={pageSize}
                onChange={(e) => {
                  setPage(1);
                  setPageSize(Number(e.target.value));
                }}
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <span className="plabel">
              {clampedPage} / {pageCount} 페이지
            </span>
            <div className="pnav">
              <button type="button" onClick={() => setPage(1)} disabled={clampedPage === 1} aria-label="첫 페이지">
                «
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={clampedPage === 1}
                aria-label="이전 페이지"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={clampedPage === pageCount}
                aria-label="다음 페이지"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => setPage(pageCount)}
                disabled={clampedPage === pageCount}
                aria-label="마지막 페이지"
              >
                »
              </button>
            </div>
          </div>

          {/* 목록 툴바에 있던 "+ 새 요구사항" 텍스트 버튼 대신, 화면 우측 하단에 항상
              떠 있는 초록 + 버튼으로 추가한다 — 스크롤·페이지 이동 중에도 바로 누를 수 있게. */}
          <Link className="fab" href={`/projects/${project.id}/requirements/new`} aria-label="새 요구사항 추가">
            +
          </Link>
        </main>
      </div>
    </div>
  );
}
