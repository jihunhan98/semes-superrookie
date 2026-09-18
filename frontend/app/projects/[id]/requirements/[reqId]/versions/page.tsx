"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import DiffHighlight from "../../../../../components/DiffHighlight";
import Header from "../../../../../components/Header";
import ProjectSidebar from "../../../../../components/ProjectSidebar";
import {
  compareVersions,
  getProject,
  getRequirement,
  type CompareResult,
  type ProjectDetail,
  type RequirementDetail,
} from "../../../../../lib/api";
import { getCurrentUser } from "../../../../../lib/session";

/** 버전 종류별 배지 색 — CSS의 .kind.major/.minor/.patch 와 짝을 이룬다. */
function kindClass(kind: string) {
  return kind.toLowerCase();
}

export default function RequirementVersionsPage() {
  const router = useRouter();
  const params = useParams<{ id: string; reqId: string }>();
  const projectId = Number(params.id);
  const requirementId = Number(params.reqId);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [req, setReq] = useState<RequirementDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 버전마다 "직전 버전 → 이 버전" diff를 미리 다 받아둔다 — +N/-N 통계를 펼치기 전에도
  // 바로 보여주려는 것. 실제 형광펜 diff 본문은 펼쳤을 때만 렌더링한다(이미 받아둔 값 재사용).
  const [diffs, setDiffs] = useState<Record<string, CompareResult>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
        if (r.versions.length === 0) return;
        // versions는 최신순 — i번째는 (i+1)번째(직전 버전)와 비교, 가장 오래된 건 base 없음(최초 확정).
        Promise.all(
          r.versions.map((v, i) =>
            compareVersions(projectId, requirementId, user.id, r.versions[i + 1]?.version ?? null, v.version),
          ),
        )
          .then((results) => {
            const map: Record<string, CompareResult> = {};
            results.forEach((d) => {
              map[d.headVersion] = d;
            });
            setDiffs(map);
          })
          .catch((err) => setError(err instanceof Error ? err.message : "버전 비교에 실패했습니다."));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "요구사항을 불러오지 못했습니다."));
  }, [projectId, requirementId, router]);

  function toggleExpand(version: string) {
    setExpanded((prev) => ({ ...prev, [version]: !prev[version] }));
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

  const versions = req.versions;

  return (
    <div className="appshell">
      <Header projectName={project.name} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="body">
        {sidebarOpen && (
          <ProjectSidebar projectId={project.id} projectName={project.name} active="requirements" />
        )}
        <main className="main">
          <div className="crumb">
            <Link href={`/projects/${project.id}/requirements`}>
              <b>요구사항</b>
            </Link>{" "}
            / {req.reqKey}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, fontFamily: "var(--mono)" }}>
              {req.reqKey}
            </h1>
            <span
              className="lbl"
              style={{ padding: "2px 11px", background: "var(--surface-muted)", color: "var(--muted)" }}
            >
              {req.stateLabel}
            </span>
            {req.version && <span className="tagv">🏷 v{req.version}</span>}
          </div>

          {/* 본문 ↔ 버전 이력 ↔ 산출물 탭 */}
          <div className="rtabs">
            <Link href={`/projects/${project.id}/requirements/${req.id}`}>본문</Link>
            <a className="on">
              버전 이력
              <span className="ct">{versions.length}</span>
            </a>
            <Link href={`/projects/${project.id}/artifacts/${req.id}`}>산출물</Link>
          </div>

          <div className="vwrap">
            {versions.length === 0 ? (
              <div className="placeholder">
                아직 확정된 적이 없습니다. 확정하면 여기에 커밋처럼 이력이 쌓입니다.
              </div>
            ) : (
              <>
                <div className="vday">📌 버전마다 바로 밑에서 직전 버전과 무엇이 달라졌는지 펼쳐 봅니다</div>

                <div className="vtimeline">
                  {versions.map((v, i) => {
                    const who = v.confirmedByName ?? "—";
                    const d = diffs[v.version];
                    const isOpen = !!expanded[v.version];
                    const prevVersion = versions[i + 1]?.version;
                    return (
                      <div className="vrow" key={v.id}>
                        <span className="vdot" />
                        <div className="vhead">
                          <span className="vtag">v{v.version}</span>
                          <span className={`kind ${kindClass(v.kind)}`}>{v.kind}</span>
                          <span className="vwho">
                            <b>{who}</b>님이 확정 · {v.createdAt ?? ""}
                          </span>
                          {d && (
                            <span className="vstat">
                              <span className="add">+{d.added}</span> <span className="del">−{d.removed}</span>
                            </span>
                          )}
                        </div>
                        <div className="vreason">&ldquo;{v.title}&rdquo;</div>
                        <button type="button" className="vexpand" onClick={() => toggleExpand(v.version)}>
                          {isOpen ? "▴" : "▾"} {prevVersion ? `v${prevVersion} → v${v.version}` : `v${v.version}`} 비교
                          보기
                        </button>
                        {isOpen && d && (
                          <div className="diff2" style={{ marginTop: 10 }}>
                            <div className="dfh">
                              📄 본문 비교 ·{" "}
                              {d.baseVersion ? `v${d.baseVersion} → v${d.headVersion}` : `v${d.headVersion} (최초 확정)`}
                            </div>
                            <div style={{ padding: "12px 14px" }}>
                              {d.baseVersion ? (
                                <DiffHighlight
                                  rows={d.rows}
                                  headLabel={`v${d.baseVersion} → v${d.headVersion}`}
                                  empty="두 버전 사이에 바뀐 부분이 없습니다."
                                />
                              ) : (
                                <div className="srctext">{d.rows.map((r) => r.headText ?? "").join("\n")}</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* 확정 전 원문 — 버전은 아니지만 어디서 출발했는지 보이게 남긴다. */}
                  <div className="vrow" style={{ opacity: 0.72 }}>
                    <span className="vdot draft" />
                    <div className="vhead">
                      <span className="vwho" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                        요구사항 등록 원문 접수
                      </span>
                    </div>
                    <div className="vreason" style={{ fontSize: 12.5, color: "var(--muted)" }}>
                      {req.requesterName ?? "요청자"} · {req.createdAt ?? ""} · 확정 전 원문
                    </div>
                  </div>
                </div>

                <div className="semver">
                  <div className="mj">
                    <b>MAJOR</b> 1.x→2.0.0 · 요구 자체 변경(상충 해소)
                  </div>
                  <div className="mn">
                    <b>MINOR</b> 1.0→1.1.0 · 해석 확정·조건 추가
                  </div>
                  <div className="pt">
                    <b>PATCH</b> 1.0.0→1.0.1 · 문구·오타 다듬기
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
