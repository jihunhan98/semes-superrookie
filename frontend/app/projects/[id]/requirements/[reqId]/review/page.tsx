"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../../../components/Header";
import ProjectSidebar from "../../../../../components/ProjectSidebar";
import {
  confirmRequirement,
  getProject,
  getRequirement,
  holdRequirement,
  reanalyzeRequirement,
  recordConsensus,
  type ProjectDetail,
  type RequirementDetail,
} from "../../../../../lib/api";
import { getCurrentUser } from "../../../../../lib/session";

/** 상충은 문장 수정으로 해결되지 않으므로 다른 색으로 구분한다. */
function isConflict(findingType: string) {
  return findingType.includes("상충");
}

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

const METHODS = ["대면 미팅", "화상회의", "유선", "메일"];

function today() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function RequirementReviewPage() {
  const router = useRouter();
  const params = useParams<{ id: string; reqId: string }>();
  const projectId = Number(params.id);
  const requirementId = Number(params.reqId);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [req, setReq] = useState<RequirementDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 1단계 — 확정될 본문. AI 제안이 반영된 draft 로 시작하고 여기서만 편집한다.
  const [draft, setDraft] = useState("");
  const [reanalyzing, setReanalyzing] = useState(false);

  // 2단계 — 고객 합의 기록 입력
  const [method, setMethod] = useState(METHODS[0]);
  const [contact, setContact] = useState("");
  const [agreedOn, setAgreedOn] = useState(today());
  const [note, setNote] = useState("");
  const [savingConsensus, setSavingConsensus] = useState(false);

  // 3단계 — 확정 / 보류
  const [working, setWorking] = useState<null | "confirm" | "hold">(null);
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
        setDraft(r.aiDraftContent);
        // 이미 확정된 요구사항은 이 화면 대신 수정 화면으로 가야 한다.
        if (r.version) router.replace(`/projects/${projectId}/requirements/${requirementId}`);
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
      setDraft(updated.aiDraftContent);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "재분석에 실패했습니다.");
    } finally {
      setReanalyzing(false);
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
        // 합의 시점의 본문을 함께 남긴다 — 이후 본문이 바뀌면 재합의가 필요한지 알 수 있다.
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
    setWorking("confirm");
    setActionError(null);
    try {
      await confirmRequirement(projectId, requirementId, { userId: user.id, content: draft });
      router.push(`/projects/${projectId}/requirements/${requirementId}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "확정에 실패했습니다.");
      setWorking(null);
    }
  }

  async function onHold() {
    const user = getCurrentUser();
    if (!user) return;
    setWorking("hold");
    setActionError(null);
    try {
      await holdRequirement(projectId, requirementId, user.id);
      router.push(`/projects/${projectId}/requirements/${requirementId}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "보류 처리에 실패했습니다.");
      setWorking(null);
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

  const dirty = draft !== req.content;
  const consensus = req.consensus;
  // 합의한 뒤에 본문을 또 고쳤다면, 지금 문장은 합의된 문장이 아니다.
  const draftChangedAfterConsensus = consensus !== null && consensus.agreedContent !== draft;
  const canConfirm = consensus !== null && draft.trim().length > 0;

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
            /{" "}
            <Link href={`/projects/${project.id}/requirements/${req.id}`}>{req.reqKey}</Link> / 최초 확정
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
            <span className="tagv">🏷 확정 시 v{req.nextVersion}</span>
          </div>

          <div className="wizard">
            {/* ── 1단계 : AI 검토 결과를 보고 본문 확정 ───────────────── */}
            <div className="wstep">
              <div className="wnum">1</div>
              <div className="wbody">
                <div className="wtitle">
                  AI 검토 결과를 보고 본문 확정
                  <span className="wsub">
                    등록 시 이미 <b>본문 전체</b>를 자동 분석했습니다. 왼쪽은{" "}
                    <b>읽기 전용 참고 자료</b>이고, 실제 편집은 오른쪽에서만 합니다.
                  </span>
                </div>

                <div className="w2col">
                  {/* 왼쪽: AI 검토 결과 — 읽기 전용. 적용 버튼 없음. */}
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
                        <span
                          className="lbl"
                          style={{
                            padding: "1px 9px",
                            marginLeft: 6,
                            background: "var(--surface-muted)",
                            color: "var(--muted)",
                          }}
                        >
                          {ENGINE_LABEL[req.aiEngine] ?? req.aiEngine}
                        </span>
                        <span className="cnt" style={{ marginLeft: 8 }}>
                          {req.findings.length}건
                        </span>
                        <button
                          className="btn sm"
                          style={{ marginLeft: 8 }}
                          onClick={onReanalyze}
                          disabled={reanalyzing}
                        >
                          {reanalyzing ? "분석 중…" : "↻ 다시 분석"}
                        </button>
                      </span>
                    </div>
                    <div className="wcb">
                      {req.findings.length === 0 ? (
                        <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                          {req.aiEngine === "unavailable"
                            ? "AI 서버가 응답하지 않아 검토를 못 했습니다. “다시 분석”을 눌러보세요."
                            : "검출된 불명확·상충이 없습니다."}
                        </p>
                      ) : (
                        req.findings.map((f, i) => (
                          <div
                            key={i}
                            className="find"
                            style={i === req.findings.length - 1 ? { marginBottom: 0 } : undefined}
                          >
                            <div className="ft">
                              <span className={`ftype2 ${isConflict(f.findingType) ? "cf" : "amb"}`}>
                                {f.findingType}
                              </span>
                              {f.targetSpan && <span className="fspan2">&ldquo;{f.targetSpan}&rdquo;</span>}
                            </div>
                            {f.reason && <div className="frs2">{f.reason}</div>}
                            {f.suggestion && (
                              <div className={isConflict(f.findingType) ? "fconf" : "aisuggest"}>
                                {isConflict(f.findingType) ? "⚠ " : "✎ 제안: "}
                                {f.suggestion}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 오른쪽: 확정될 본문 — 제안이 이미 반영된 상태로 채워져 있다. */}
                  <div className="wcard">
                    <div className="wch">
                      ✏️ 확정될 본문
                      <span className="rt">
                        <span className="lbl blue" style={{ padding: "1px 9px" }}>
                          여기서만 편집
                        </span>
                      </span>
                    </div>
                    <div className="wcb">
                      {dirty ? (
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
                          지금은 <b>등록 원문과 같습니다</b>. 그대로 확정해도 되고, 고쳐도 됩니다.
                        </div>
                      )}
                      <textarea
                        className="reqta"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                      />
                      <div className="prefill-act">
                        <button
                          className="btn sm"
                          onClick={() => setDraft(req.content)}
                          disabled={!dirty}
                        >
                          ↩ 등록 원문으로 되돌리기
                        </button>
                        <span className="pf-orig">등록 원문: &ldquo;{req.content}&rdquo;</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── 2단계 : 고객 합의 ─────────────────────────────────── */}
            <div className="wstep">
              <div className={`wnum${consensus ? " ok" : ""}`}>2</div>
              <div className="wbody">
                <div className="wtitle">
                  고객 합의
                  <span className="wsub">
                    이 문장으로 확정해도 되는지 고객과 협의한 <b>결과</b>를 기록합니다 — 이 기록
                    없이는 확정할 수 없습니다.
                  </span>
                </div>

                <div className="wcard" style={{ borderColor: "var(--purple)" }}>
                  <div className="wcb consensus">
                    {consensus ? (
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
                            ⚠ 합의한 뒤에 본문이 바뀌었습니다. 이대로 확정하면 <b>합의한 문장과
                            다른 내용</b>이 확정됩니다 — 고객과 다시 확인하고 아래에서 합의를 다시
                            기록하세요.
                          </div>
                        )}
                        <div className="prefill-act">
                          <button
                            className="btn sm"
                            onClick={() => setReq({ ...req, consensus: null })}
                          >
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
                          placeholder="가용/최단거리 판정 기준을 위 문장대로 확정하기로 합의. req-ta-01 우선순위 상충은 별도 건으로 후속 협의."
                        />
                        <div className="wfoot">
                          <button
                            className="btn prim"
                            onClick={onSaveConsensus}
                            disabled={savingConsensus}
                          >
                            {savingConsensus ? "저장 중…" : "합의 기록 저장"}
                          </button>
                          <span className="note">
                            위 1단계의 <b>확정될 본문</b>이 합의 대상으로 함께 기록됩니다.
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── 3단계 : 확정 ─────────────────────────────────────── */}
            <div className="wstep">
              <div className={`wnum${canConfirm ? "" : " off"}`}>3</div>
              <div className="wbody">
                <div className="wtitle">
                  확정
                  <span className="wsub">
                    최초 확정이므로 <b>수정 사유를 입력하지 않습니다</b> — 버전 이력 제목은 &ldquo;최초
                    확정&rdquo;으로 자동 기록됩니다.
                  </span>
                </div>
                <div className="wcard">
                  <div className="wcb">
                    {actionError && (
                      <p className="lmsg err" style={{ marginTop: 0 }}>
                        {actionError}
                      </p>
                    )}
                    <div className="wfoot" style={{ marginTop: 0 }}>
                      <button
                        className="btn prim"
                        onClick={onConfirm}
                        disabled={!canConfirm || working !== null}
                      >
                        {working === "confirm" ? "확정 중…" : `확정 저장 → v${req.nextVersion}`}
                      </button>
                      <button className="btn" onClick={onHold} disabled={working !== null}>
                        {working === "hold" ? "처리 중…" : "보류"}
                      </button>
                      <button
                        className="btn"
                        onClick={() => router.push(`/projects/${projectId}/requirements/${requirementId}`)}
                        disabled={working !== null}
                      >
                        취소
                      </button>
                      <span className="note">
                        {canConfirm
                          ? "확정 후에는 이 화면 대신 수정 화면으로 들어갑니다."
                          : "2단계 합의 기록이 없으면 확정할 수 없습니다."}
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
