"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../../../components/Header";
import ProjectSidebar from "../../../../../components/ProjectSidebar";
import { colorFor } from "../../../../../lib/colors";
import {
  compareVersions,
  getProject,
  getRequirement,
  type CompareResult,
  type ProjectDetail,
  type RequirementDetail,
} from "../../../../../lib/api";
import { getCurrentUser } from "../../../../../lib/session";

type DiffMode = "split" | "unified";

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

  const [base, setBase] = useState<string>("");
  const [head, setHead] = useState<string>("");
  const [diff, setDiff] = useState<CompareResult | null>(null);
  const [diffMode, setDiffMode] = useState<DiffMode>("split");
  const [comparing, setComparing] = useState(false);

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
        // 기본 비교 대상: 직전 버전 ↔ 최신 버전. versions 는 최신순으로 온다.
        if (r.versions.length > 0) {
          setHead(r.versions[0].version);
          setBase(r.versions.length > 1 ? r.versions[1].version : "");
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "요구사항을 불러오지 못했습니다."));
  }, [projectId, requirementId, router]);

  const loadDiff = useCallback(async () => {
    const user = getCurrentUser();
    if (!user || !head) return;
    setComparing(true);
    try {
      setDiff(await compareVersions(projectId, requirementId, user.id, base || null, head));
    } catch (err) {
      setError(err instanceof Error ? err.message : "버전 비교에 실패했습니다.");
    } finally {
      setComparing(false);
    }
  }, [projectId, requirementId, base, head]);

  useEffect(() => {
    if (head) void loadDiff();
  }, [head, base, loadDiff]);

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
  const latest = versions[0]?.version;

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

          {/* 본문 ↔ 버전 이력 탭 */}
          <div className="rtabs">
            <Link href={`/projects/${project.id}/requirements/${req.id}`}>본문</Link>
            <a className="on">
              버전 이력
              <span className="ct">{versions.length}</span>
            </a>
          </div>

          <div className="vwrap">
            {versions.length === 0 ? (
              <div className="placeholder">
                아직 확정된 적이 없습니다. 확정하면 여기에 커밋처럼 이력이 쌓입니다.
              </div>
            ) : (
              <>
                {/* 비교 바 — base ↔ compare 를 골라 무엇이 바뀌었는지 본다. */}
                <div className="cmpbar">
                  <span className="lbl0">버전 비교</span>
                  <span className="cmpsel">
                    base
                    <select value={base} onChange={(e) => setBase(e.target.value)}>
                      <option value="">(없음 · 최초)</option>
                      {versions.map((v) => (
                        <option key={v.id} value={v.version}>
                          v{v.version}
                        </option>
                      ))}
                    </select>
                  </span>
                  <span className="cmparr">→</span>
                  <span className="cmpsel">
                    compare
                    <select value={head} onChange={(e) => setHead(e.target.value)}>
                      {versions.map((v) => (
                        <option key={v.id} value={v.version}>
                          v{v.version}
                        </option>
                      ))}
                    </select>
                  </span>
                  <span className="cmpstat">
                    {comparing ? (
                      "비교 중…"
                    ) : diff ? (
                      <>
                        <span className="add">＋{diff.added}</span>{" "}
                        <span className="del">−{diff.removed}</span> ·{" "}
                        {diff.added + diff.removed === 0 ? "변경 없음" : "본문 변경"}
                      </>
                    ) : (
                      ""
                    )}
                  </span>
                  <span className="difftoggle" style={{ marginLeft: 12 }}>
                    <button
                      className={diffMode === "split" ? "on" : ""}
                      onClick={() => setDiffMode("split")}
                    >
                      split
                    </button>
                    <button
                      className={diffMode === "unified" ? "on" : ""}
                      onClick={() => setDiffMode("unified")}
                    >
                      unified
                    </button>
                  </span>
                </div>

                {diff && (
                  <div className="diff2">
                    <div className="dfh">
                      📄 요구사항 본문 ·{" "}
                      <b style={{ fontFamily: "var(--mono)" }}>{req.reqKey}</b>
                      <span style={{ color: "var(--muted)", fontWeight: 500 }}>
                        — {diff.headConfirmedByName ?? "—"} · {diff.headTitle} · {diff.headCreatedAt ?? ""}
                      </span>
                    </div>

                    {diffMode === "split" ? (
                      <div className="split2">
                        <div className="sc1">
                          <div className="sh">
                            🏷 {diff.baseVersion ? `v${diff.baseVersion} (base)` : "이전 버전 없음"}
                          </div>
                          {diff.rows.map((r, i) => (
                            <div
                              key={i}
                              className={`dln ${
                                r.baseText === null ? "emp" : r.type === "ctx" ? "ctx" : "del"
                              }`}
                            >
                              <span className="no">{r.baseNo ?? ""}</span>
                              <span className="lc">{r.baseText ?? ""}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <div className="sh">🏷 v{diff.headVersion} (compare)</div>
                          {diff.rows.map((r, i) => (
                            <div
                              key={i}
                              className={`dln ${
                                r.headText === null ? "emp" : r.type === "ctx" ? "ctx" : "add"
                              }`}
                            >
                              <span className="no">{r.headNo ?? ""}</span>
                              <span className="lc">{r.headText ?? ""}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* unified — 삭제 줄을 먼저, 추가 줄을 뒤에 한 줄로 이어 붙인다. */
                      <div>
                        {diff.rows.flatMap((r, i) => {
                          if (r.type === "ctx") {
                            return [
                              <div key={`c${i}`} className="dln ctx">
                                <span className="no">{r.headNo ?? r.baseNo ?? ""}</span>
                                <span className="lc">{r.headText ?? r.baseText ?? ""}</span>
                              </div>,
                            ];
                          }
                          const out = [];
                          if (r.baseText !== null) {
                            out.push(
                              <div key={`d${i}`} className="dln del">
                                <span className="no">{r.baseNo ?? ""}</span>
                                <span className="lc">− {r.baseText}</span>
                              </div>,
                            );
                          }
                          if (r.headText !== null) {
                            out.push(
                              <div key={`a${i}`} className="dln add">
                                <span className="no">{r.headNo ?? ""}</span>
                                <span className="lc">＋ {r.headText}</span>
                              </div>,
                            );
                          }
                          return out;
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 커밋처럼 쌓인 확정 이력 */}
                <div className="vday">📌 버전 이력 · 확정·수정할 때마다 커밋처럼 쌓입니다</div>
                <div className="commits">
                  {versions.map((v) => {
                    const who = v.confirmedByName ?? "—";
                    return (
                      <div className="cm" key={v.id}>
                        <span className="av2" style={{ background: colorFor(who) }}>
                          {who.slice(0, 1)}
                        </span>
                        <div className="cmain">
                          <div className="ctitle">{v.title}</div>
                          <div className="cmeta">
                            <b>{who}</b>님이 확정 · {v.createdAt ?? ""}
                          </div>
                        </div>
                        <div className="cright">
                          <span className={`kind ${kindClass(v.kind)}`}>{v.kind}</span>
                          <span className={`verpill ${v.version === latest ? "cur" : "old"}`}>
                            v{v.version}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {/* 확정 전 원문 — 버전은 아니지만 어디서 출발했는지 보이게 남긴다. */}
                  <div className="cm" style={{ opacity: 0.72 }}>
                    <span className="av2" style={{ background: "var(--faint)" }}>
                      ·
                    </span>
                    <div className="cmain">
                      <div className="ctitle">요구사항 등록 원문 접수</div>
                      <div className="cmeta">
                        {req.requesterName ?? "요청자"} · {req.createdAt ?? ""} · 확정 전 원문
                      </div>
                    </div>
                    <div className="cright">
                      <span className="verpill old">draft</span>
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
