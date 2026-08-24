"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AiFindings from "../../../../components/AiFindings";
import Header from "../../../../components/Header";
import ProjectSidebar from "../../../../components/ProjectSidebar";
import {
  getProject,
  getRequirement,
  reanalyzeRequirement,
  type ProjectDetail,
  type RequirementDetail,
} from "../../../../lib/api";
import { getCurrentUser } from "../../../../lib/session";

/**
 * 어떻게 검토됐는지 배지.
 *
 * rule 은 "검토를 못 했다"가 아니라 "규칙 기반으로 검토했다"는 뜻이다 — 규칙 검출은
 * 사내 LLM 유무와 무관하게 항상 돌기 때문. 그래서 unavailable(=AI 서버 자체가 응답
 * 못 함)과 구분해서 표시한다.
 */
const ENGINE_LABEL: Record<string, string> = {
  "llm-api": "사내 LLM",
  rule: "규칙 기반",
  unavailable: "AI 미응답",
};

export default function RequirementDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string; reqId: string }>();
  const projectId = Number(params.id);
  const requirementId = Number(params.reqId);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [req, setReq] = useState<RequirementDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);

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

  async function onReanalyze() {
    const user = getCurrentUser();
    if (!user) return;
    setReanalyzing(true);
    try {
      const updated = await reanalyzeRequirement(projectId, requirementId, user.id);
      setReq(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "재분석에 실패했습니다.");
    } finally {
      setReanalyzing(false);
    }
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
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, fontFamily: "var(--mono)" }}>{req.reqKey}</h1>
            <span className="lbl" style={{ padding: "2px 11px", background: "var(--surface-muted)", color: "var(--muted)" }}>
              {req.stateLabel}
            </span>
            {req.version && <span className="tagv">🏷 v{req.version}</span>}
            {/* 이 페이지는 읽기 전용 — 실제 편집(확정 포함)은 전부 이 버튼 너머에서 한다.
                확정 전이면 최초 확정 화면(화면 4), 확정 후에는 확정본 수정 화면(화면 5). */}
            <Link
              className="btn prim"
              href={
                req.version
                  ? `/projects/${project.id}/requirements/${req.id}/edit`
                  : `/projects/${project.id}/requirements/${req.id}/review`
              }
              style={{ marginLeft: "auto" }}
            >
              수정하기
            </Link>
          </div>

          {/* 본문 ↔ 버전 이력 탭 */}
          <div className="rtabs">
            <a className="on">본문</a>
            <Link href={`/projects/${project.id}/requirements/${req.id}/versions`}>
              버전 이력
              <span className="ct">{req.versions.length}</span>
            </Link>
          </div>

          {/* 이 화면은 읽기 전용이다 — 본문을 고치는 건 위 "수정하기"로 들어간 화면
              (최초 확정/확정본 수정)에서만 한다. 그래서 편집용 textarea 를 여기 두지
              않는다. AI 검토 결과 카드 안에서 본문(등록 원문 또는 확정본)을 하이라이트와
              함께 그대로 보여준다. */}
          <div className="wcard readonly" style={{ marginTop: 16, maxWidth: 1400 }}>
            <div className="wch">
              🤖 AI 검토 결과
              <span className="rt">
                <span className="lbl" style={{ padding: "1px 9px", background: "var(--surface-muted)", color: "var(--muted)" }}>
                  읽기 전용
                </span>
                <span className="lbl" style={{ padding: "1px 9px", marginLeft: 6, background: "var(--surface-muted)", color: "var(--muted)" }}>
                  {ENGINE_LABEL[req.aiEngine] ?? req.aiEngine}
                </span>
                <span className="cnt" style={{ marginLeft: 8 }}>
                  {req.findings.length}건
                </span>
                <button className="btn sm" style={{ marginLeft: 8 }} onClick={onReanalyze} disabled={reanalyzing}>
                  {reanalyzing ? "분석 중…" : "↻ 다시 분석"}
                </button>
              </span>
            </div>
            <div className="wcb">
              {/* 원문을 먼저 보여주고 지적된 구절에 형광펜을 칠한다 — 구절만 적어 두면
                  사용자가 원문 어디인지 직접 찾아야 해서 불편하다. */}
              <AiFindings
                content={req.content}
                findings={req.findings}
                contentLabel={req.version ? `확정본 v${req.version}` : "등록 원문"}
                empty={
                  req.aiEngine === "unavailable"
                    ? "AI 서버가 응답하지 않아 검토를 못 했습니다. “다시 분석”을 눌러보세요."
                    : "검출된 불명확·상충이 없습니다."
                }
              />
            </div>
          </div>

          <div className="jf" style={{ maxWidth: 1400, marginTop: 16, borderBottom: "none", gap: 22, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
              <b style={{ color: "var(--muted)", fontWeight: 600 }}>요청자</b>{" "}
              {req.requesterDept ? `${req.requesterDept} · ` : ""}
              {req.requesterName ?? "—"}
            </span>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
              <b style={{ color: "var(--muted)", fontWeight: 600 }}>담당자</b> {req.assigneeName ?? "—"}
            </span>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
              <b style={{ color: "var(--muted)", fontWeight: 600 }}>등록일</b> {req.createdAt ?? "—"}
            </span>
          </div>

          {/* 고객 합의 기록 — 확정의 근거. 어느 버전이 이 합의로 확정됐는지(또는 아직
              확정에 안 쓰였는지)를 같이 보여준다 — "합의는 했는데 이게 언제 확정에
              반영된 건지" 를 따로 찾아보지 않아도 되게. */}
          <div className="wcard" style={{ marginTop: 16, maxWidth: 1400, borderColor: "var(--purple)" }}>
            <div className="wch">
              🤝 고객 합의
              {req.consensus && (
                <span className="rt cdone">
                  {req.consensus.usedForVersion ? `✓ v${req.consensus.usedForVersion} 확정 근거` : "✓ 합의 완료"}
                </span>
              )}
            </div>
            <div className="wcb consensus">
              {req.consensus ? (
                <>
                  <div className="crow">
                    <span>
                      <b>방법</b>
                      {req.consensus.method}
                    </span>
                    <span>
                      <b>고객측 담당자</b>
                      {req.consensus.customerContact}
                    </span>
                    <span>
                      <b>합의일</b>
                      {req.consensus.agreedOn}
                    </span>
                    {req.consensus.recordedByName && (
                      <span>
                        <b>기록</b>
                        {req.consensus.recordedByName}
                      </span>
                    )}
                  </div>
                  {req.consensus.note && <div className="ctext">{req.consensus.note}</div>}
                  {!req.consensus.usedForVersion && (
                    <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "10px 0 0" }}>
                      아직 어떤 확정에도 쓰이지 않았습니다 — 다음 확정의 근거가 됩니다.
                    </p>
                  )}
                </>
              ) : (
                <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                  아직 합의 기록이 없습니다. AI 의견이 합리적이어도 <b>고객 합의 없이는 확정할 수
                  없습니다</b> — 위 &ldquo;수정하기&rdquo;에서 기록하세요.
                </p>
              )}
            </div>
          </div>

          {/* 확정 이력은 "버전 이력" 탭에서 diff 와 함께 본다 — 여기서 중복해 보여주지 않는다. */}
          {req.versions.length > 0 && (
            <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 16 }}>
              확정 이력 {req.versions.length}건 ·{" "}
              <Link
                href={`/projects/${project.id}/requirements/${req.id}/versions`}
                style={{ color: "var(--accent)", fontWeight: 600 }}
              >
                버전 이력에서 무엇이 바뀌었는지 비교 →
              </Link>
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
