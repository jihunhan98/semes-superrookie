"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AiFindings from "../../../../../components/AiFindings";
import Header from "../../../../../components/Header";
import ProjectSidebar from "../../../../../components/ProjectSidebar";
import {
  confirmRequirement,
  diffAnalyzeRequirement,
  getProject,
  getRequirement,
  recordConsensus,
  type ProjectDetail,
  type RequirementDetail,
} from "../../../../../lib/api";
import { getCurrentUser } from "../../../../../lib/session";

const METHODS = ["대면 미팅", "화상회의", "유선", "메일"];

function today() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function RequirementEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string; reqId: string }>();
  const projectId = Number(params.id);
  const requirementId = Number(params.reqId);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [req, setReq] = useState<RequirementDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  /** 이 화면에 들어온 시점의 확정본. "되돌리기"의 기준이 된다. */
  const [baseContent, setBaseContent] = useState("");
  /** 들어온 시점의 확정 버전 — 헤더의 "v1.0.1 → v1.0.2" 표시에 쓴다. */
  const [baseVersion, setBaseVersion] = useState<string | null>(null);

  // 1단계 — 수정 사유(필수)
  const [reason, setReason] = useState("");
  // 2단계 — 최종 본문 + AI 검토
  const [draft, setDraft] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  // 3단계 — 고객 합의
  const [method, setMethod] = useState(METHODS[0]);
  const [contact, setContact] = useState("");
  const [agreedOn, setAgreedOn] = useState(today());
  const [note, setNote] = useState("");
  const [savingConsensus, setSavingConsensus] = useState(false);
  // 4단계 — 변경 사유(버전 이력 제목) + 확정
  const [commitTitle, setCommitTitle] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
        setBaseContent(r.content);
        setBaseVersion(r.version);
        setDraft(r.content);
        // 확정된 적 없는 요구사항은 수정이 아니라 최초 확정으로 가야 한다.
        if (!r.version) router.replace(`/projects/${projectId}/requirements/${requirementId}/review`);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "요구사항을 불러오지 못했습니다."));
  }, [projectId, requirementId, router]);

  async function onAnalyze() {
    const user = getCurrentUser();
    if (!user) return;
    if (!reason.trim()) {
      setActionError("수정 사유를 먼저 입력하세요 — AI가 이 내용을 함께 참고합니다.");
      return;
    }
    setAnalyzing(true);
    setActionError(null);
    try {
      const updated = await diffAnalyzeRequirement(projectId, requirementId, {
        userId: user.id,
        content: draft,
        reason: reason.trim(),
      });
      setReq(updated);
      // 제안이 반영된 문장으로 본문을 채운다 — 화면 4와 같은 방식.
      setDraft(updated.aiDraftContent);
      setAnalyzed(true);
      // 변경 사유 기본값으로 수정 사유를 넣어준다. 그대로 써도 되고 고쳐도 된다.
      if (!commitTitle.trim()) setCommitTitle(reason.trim());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "AI 검토에 실패했습니다.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function onSaveConsensus() {
    const user = getCurrentUser();
    if (!user) return;
    if (!contact.trim()) {
      setActionError("고객측 담당자를 입력하세요.");
      return;
    }
    setSavingConsensus(true);
    setActionError(null);
    try {
      const updated = await recordConsensus(projectId, requirementId, {
        userId: user.id,
        method,
        customerContact: contact.trim(),
        agreedOn,
        note: note.trim(),
        agreedContent: draft,
      });
      setReq(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "합의 기록에 실패했습니다.");
    } finally {
      setSavingConsensus(false);
    }
  }

  async function onConfirm() {
    const user = getCurrentUser();
    if (!user) return;
    if (!commitTitle.trim()) {
      setActionError("변경 사유를 입력하세요 — 버전 이력의 제목이 됩니다.");
      return;
    }
    setConfirming(true);
    setActionError(null);
    try {
      await confirmRequirement(projectId, requirementId, {
        userId: user.id,
        content: draft,
        title: commitTitle.trim(),
      });
      router.push(`/projects/${projectId}/requirements/${requirementId}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "확정에 실패했습니다.");
      setConfirming(false);
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

  const dirty = draft !== baseContent;
  const consensus = req.consensus;
  // 이 화면에서 새로 기록한 합의만 유효하다. canConfirm 이 그 판단(미사용 합의)을 담고 있다.
  const consensusReady = consensus !== null && req.canConfirm;
  const draftChangedAfterConsensus = consensusReady && consensus.agreedContent !== draft;
  const canConfirm = consensusReady && commitTitle.trim().length > 0 && draft.trim().length > 0;

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
            / <Link href={`/projects/${project.id}/requirements/${req.id}`}>{req.reqKey}</Link> / 수정
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, fontFamily: "var(--mono)" }}>
              {req.reqKey}
            </h1>
            <span className="lbl blue" style={{ padding: "2px 11px" }}>
              {req.stateLabel}
            </span>
            <span className="tagv">
              🏷 v{baseVersion} → v{req.nextVersion}
            </span>
          </div>

          <div className="wizard">
            {/* ── 1단계 : 수정 사유 ────────────────────────────────── */}
            <div className="wstep">
              <div className={`wnum${reason.trim() ? " ok" : ""}`}>1</div>
              <div className="wbody">
                <div className="wtitle">
                  수정 사유
                  <span className="wsub">
                    왜 바꾸는지 — 고객 요청이든 직접 판단이든 자유롭게. <b>AI가 이 내용을 함께
                    참고합니다.</b>
                  </span>
                </div>
                <div className="wcard">
                  <div className="wcb">
                    <textarea
                      className="reqta"
                      style={{ minHeight: 72 }}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="req-ta-01과 우선순위 기준이 달라 충돌합니다. 두 요구사항 모두 SoC(배터리 잔량) 높은 순으로 통일해주세요. — 삼성전자 EDS 김민석 책임"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── 2단계 : AI 검토 결과를 보고 본문 수정 ─────────────── */}
            <div className="wstep">
              <div className={`wnum${analyzed ? " ok" : ""}`}>2</div>
              <div className="wbody">
                <div className="wtitle">
                  AI 검토 결과를 보고 본문 수정
                  <span className="wsub">
                    위 카드는 상세 화면과 같은 <b>읽기 전용 참고 자료</b>이고, 실제 편집은 아래
                    본문 칸에서만 합니다.
                  </span>
                </div>

                {/* 위: AI 검토 결과 — 요구사항 상세 화면과 같은 형식(읽기 전용, 하이라이트). */}
                <div className="wcard readonly">
                  <div className="wch">
                    🤖 AI 검토 결과
                    <span className="rt">
                      <span
                        className="lbl"
                        style={{ padding: "1px 9px", background: "var(--surface-muted)", color: "var(--muted)" }}
                      >
                        읽기 전용
                      </span>
                      <span className="cnt diff" style={{ marginLeft: 8 }}>
                        변경분만 분석
                      </span>
                    </span>
                  </div>
                  <div className="wcb">
                    {!analyzed ? (
                      <>
                        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 10px" }}>
                          아래 본문을 고치고 <b>AI 검토 실행</b>을 누르면, 확정본 대비{" "}
                          <b>바뀐 부분과 수정 사유만</b> 검토합니다. 이미 합의된 나머지 문장은
                          건드리지 않습니다.
                        </p>
                        <button className="btn prim" onClick={onAnalyze} disabled={analyzing}>
                          {analyzing ? "분석 중…" : "AI 검토 실행"}
                        </button>
                      </>
                    ) : (
                      <>
                        {/* 검출 구절은 바뀐 뒤 문장(draft) 기준이라 draft 에 형광펜을 칠한다. */}
                        <AiFindings
                          content={draft}
                          findings={req.findings}
                          contentLabel="최종 본문 (변경분만 검토)"
                          empty="바뀐 부분에서 새로 검출된 문제가 없습니다."
                        />
                        <div className="wnote">
                          {req.findings.length === 0
                            ? "이번에 바뀐 부분만 분석 · 새로운 이슈 없음"
                            : "이번에 바뀐 부분만 분석 · 확정본 전체는 다시 보지 않음"}
                        </div>
                        <div className="prefill-act">
                          <button className="btn sm" onClick={onAnalyze} disabled={analyzing}>
                            {analyzing ? "분석 중…" : "↻ 다시 분석"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 아래: 최종 본문 — 여기서만 편집. AI 카드와 나란히 두지 않고 아래로
                    뺀 이유는 편집이 참고 자료 보기와 뒤섞이지 않게 하려는 것. */}
                <div className="wcard" style={{ marginTop: 16 }}>
                  <div className="wch">
                    ✏️ 최종 본문
                    <span className="rt">
                      <span className="lbl blue" style={{ padding: "1px 9px" }}>
                        여기서만 편집
                      </span>
                    </span>
                  </div>
                  <div className="wcb">
                    {analyzed ? (
                      <div className="prefill">
                        ⬇ 위 <b>AI 제안이 이미 반영된 상태</b>로 채워져 있습니다. 그대로 확정하거나,
                        아래 텍스트를 직접 고치세요.
                      </div>
                    ) : (
                      <div
                        className="prefill"
                        style={{
                          background: "var(--surface-muted)",
                          borderColor: "var(--line)",
                          color: "var(--muted)",
                        }}
                      >
                        지금은 <b>확정본(v{baseVersion}) 그대로</b>입니다. 고칠 부분을 수정한 뒤 위에서
                        AI 검토를 실행하세요.
                      </div>
                    )}
                    <textarea
                      className="reqta"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                    <div className="prefill-act">
                      <button className="btn sm" onClick={() => setDraft(baseContent)} disabled={!dirty}>
                        ↩ 확정본(v{baseVersion})으로 되돌리기
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── 3단계 : 고객 합의 ────────────────────────────────── */}
            <div className="wstep">
              <div className={`wnum${consensusReady ? " ok" : ""}`}>3</div>
              <div className="wbody">
                <div className="wtitle">
                  고객 합의
                  <span className="wsub">
                    고객과 협의한 <b>결과</b>를 기록합니다 — 이 기록 없이는 확정할 수 없습니다.
                  </span>
                </div>

                <div className="wcard" style={{ borderColor: "var(--purple)" }}>
                  <div className="wcb consensus">
                    {consensusReady ? (
                      <>
                        <div className="crow">
                          <span>
                            <b>방법</b>
                            {consensus.method}
                          </span>
                          <span>
                            <b>고객측 담당자</b>
                            {consensus.customerContact}
                          </span>
                          <span>
                            <b>합의일</b>
                            {consensus.agreedOn}
                          </span>
                          {consensus.recordedByName && (
                            <span>
                              <b>기록</b>
                              {consensus.recordedByName}
                            </span>
                          )}
                          <span className="cdone">✓ 합의 완료</span>
                        </div>
                        {consensus.note && <div className="ctext">{consensus.note}</div>}
                        {draftChangedAfterConsensus && (
                          <div className="fconf" style={{ marginTop: 10 }}>
                            ⚠ 합의한 뒤에 본문이 바뀌었습니다. 이대로 확정하면 <b>합의한 문장과 다른
                            내용</b>이 확정됩니다 — 고객과 다시 확인하고 아래에서 합의를 다시
                            기록하세요.
                          </div>
                        )}
                        <div className="prefill-act">
                          <button className="btn sm" onClick={() => setReq({ ...req, canConfirm: false })}>
                            ✎ 합의 다시 기록
                          </button>
                          <span className="pf-orig">
                            합의된 문장: &ldquo;{consensus.agreedContent}&rdquo;
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="cform">
                          <div className="fi2">
                            <div className="fieldlab">합의 방법</div>
                            <select value={method} onChange={(e) => setMethod(e.target.value)}>
                              {METHODS.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="fi2">
                            <div className="fieldlab">고객측 담당자</div>
                            <input
                              value={contact}
                              onChange={(e) => setContact(e.target.value)}
                              placeholder="삼성전자 EDS 김민석 책임"
                            />
                          </div>
                          <div className="fi2">
                            <div className="fieldlab">합의일</div>
                            <input
                              type="date"
                              value={agreedOn}
                              onChange={(e) => setAgreedOn(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="fieldlab">합의 내용</div>
                        <textarea
                          className="reqta"
                          style={{ minHeight: 84 }}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="위 수정안(우선순위 req-ta-01 기준 통일)에 동의함. 회신 메일로 확인."
                        />
                        <div className="wfoot">
                          <button className="btn prim" onClick={onSaveConsensus} disabled={savingConsensus}>
                            {savingConsensus ? "저장 중…" : "합의 기록 저장"}
                          </button>
                          <span className="note">
                            위 2단계의 <b>최종 본문</b>이 합의 대상으로 함께 기록됩니다.
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── 4단계 : 변경 사유 확인 후 확정 ───────────────────── */}
            <div className="wstep">
              <div className={`wnum${canConfirm ? "" : " off"}`}>4</div>
              <div className="wbody">
                <div className="wtitle">
                  변경 사유 확인 후 확정
                  <span className="wsub">이 문구가 버전 이력의 제목이 됩니다 (커밋 메시지).</span>
                </div>
                <div className="wcard">
                  <div className="wcb">
                    <div className="commitin">
                      <input
                        value={commitTitle}
                        onChange={(e) => setCommitTitle(e.target.value)}
                        placeholder="req-ta-01과 우선순위 기준 통일 (고객 요청 반영, 합의 완료)"
                      />
                      <span className="aihint">✨ 수정 사유에서 채움 · 편집 가능</span>
                    </div>
                    {actionError && (
                      <p className="lmsg err" style={{ marginBottom: 0 }}>
                        {actionError}
                      </p>
                    )}
                    <div className="wfoot">
                      <button className="btn prim" onClick={onConfirm} disabled={!canConfirm || confirming}>
                        {confirming ? "확정 중…" : `확정 저장 → v${req.nextVersion}`}
                      </button>
                      <button
                        className="btn"
                        onClick={() => router.push(`/projects/${projectId}/requirements/${requirementId}`)}
                        disabled={confirming}
                      >
                        취소
                      </button>
                      <span className="note">
                        {canConfirm
                          ? "작성자·시각·사유와 함께 버전 이력에 남습니다."
                          : "3단계 합의 기록과 변경 사유가 있어야 확정할 수 있습니다."}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
