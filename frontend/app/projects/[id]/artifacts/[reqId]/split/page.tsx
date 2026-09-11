"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../../../components/Header";
import ProjectSidebar from "../../../../../components/ProjectSidebar";
import { locateSpans } from "../../../../../lib/highlight";
import { ISSUE_PALETTE as PALETTE } from "../../../../../lib/issuePalette";
import {
  confirmIssueSplit,
  getArtifact,
  getProject,
  getRequirement,
  listDevIssues,
  previewIssueSplit,
  type ArtifactTypeSlug,
  type ProjectDetail,
  type RequirementDetail,
} from "../../../../../lib/api";
import { getCurrentUser } from "../../../../../lib/session";

/** AI 검토 화면과 같은 세 상태. */
const ENGINE_LABEL: Record<string, string> = {
  "llm-api": "사내 LLM",
  rule: "규칙 기반",
  unavailable: "AI 미응답 · 전체를 이슈 1개로 시작",
};

/** 이슈 확정 직후 산출물을 한 번에 미리 만들어 둘 때 도는 유형 4가지. */
const ARTIFACT_TYPES: ArtifactTypeSlug[] = ["voc", "functional", "nonfunctional", "detail-design"];

type Candidate = { clientId: string; title: string; quote: string };

let clientIdSeq = 0;
function newClientId() {
  clientIdSeq += 1;
  return `c${Date.now()}-${clientIdSeq}`;
}

/** 확정본을 그대로 보여주되, 이슈 후보의 구절마다 다른 색 형광펜을 칠한다. */
function HighlightedRequirement({
  content,
  candidates,
  active,
  onActive,
}: {
  content: string;
  candidates: Candidate[];
  active: number | null;
  onActive: (idx: number | null) => void;
}) {
  const { marks } = useMemo(
    () => locateSpans(content, candidates.map((c) => c.quote)),
    [content, candidates],
  );

  const parts: ReactNode[] = [];
  let cursor = 0;
  marks.forEach((m) => {
    if (m.start > cursor) parts.push(content.slice(cursor, m.start));
    const color = PALETTE[m.idx % PALETTE.length];
    parts.push(
      <mark
        key={`m${m.idx}-${m.start}`}
        className={`hl2${active === m.idx ? " on" : ""}`}
        style={{ "--m": color.m, "--ms": color.ms } as CSSProperties}
        onMouseEnter={() => onActive(m.idx)}
        onMouseLeave={() => onActive(null)}
      >
        {content.slice(m.start, m.end)}
        <span className="no">{m.idx + 1}</span>
      </mark>,
    );
    cursor = m.end;
  });
  if (cursor < content.length) parts.push(content.slice(cursor));

  return <div className="srctext">{parts}</div>;
}

export default function IssueSplitPage() {
  const router = useRouter();
  const params = useParams<{ id: string; reqId: string }>();
  const projectId = Number(params.id);
  const requirementId = Number(params.reqId);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [req, setReq] = useState<RequirementDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [engine, setEngine] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);

  const [aiReason, setAiReason] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [generateProgress, setGenerateProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!Number.isFinite(projectId) || !Number.isFinite(requirementId)) return;

    Promise.all([getProject(projectId, user.id), getRequirement(projectId, requirementId, user.id)])
      .then(async ([p, r]) => {
        setProject(p);
        setReq(r);
        if (r.state !== "CONFIRMED") return; // 아래 화면에서 안내만 하고 더 부르지 않는다.

        // 이미 나눠 놓은 이슈가 있으면 그걸 이어서 고치고, 없으면 AI 초안부터 받는다.
        const existing = await listDevIssues(projectId, requirementId, user.id);
        if (existing.length > 0) {
          setCandidates(
            existing.map((i) => ({ clientId: `saved-${i.id}`, title: i.title, quote: i.quote ?? "" })),
          );
        } else {
          const preview = await previewIssueSplit(projectId, requirementId, { userId: user.id, reason: "" });
          setCandidates(preview.issues.map((i) => ({ clientId: newClientId(), title: i.title, quote: i.quote })));
          setEngine(preview.engine);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "요구사항을 불러오지 못했습니다."));
  }, [projectId, requirementId, router]);

  async function onRegenerate() {
    const user = getCurrentUser();
    if (!user) return;
    setRegenerating(true);
    setRegenError(null);
    try {
      const preview = await previewIssueSplit(projectId, requirementId, {
        userId: user.id,
        reason: aiReason.trim(),
      });
      setCandidates(preview.issues.map((i) => ({ clientId: newClientId(), title: i.title, quote: i.quote })));
      setEngine(preview.engine);
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : "AI 분할에 실패했습니다.");
    } finally {
      setRegenerating(false);
    }
  }

  function updateCandidate(clientId: string, patch: Partial<Candidate>) {
    setCandidates((prev) => (prev ? prev.map((c) => (c.clientId === clientId ? { ...c, ...patch } : c)) : prev));
  }

  function removeCandidate(clientId: string) {
    setCandidates((prev) => (prev ? prev.filter((c) => c.clientId !== clientId) : prev));
  }

  function addCandidate() {
    setCandidates((prev) => [...(prev ?? []), { clientId: newClientId(), title: "", quote: "" }]);
  }

  const located = useMemo(() => {
    if (!req || !candidates) return [] as boolean[];
    return locateSpans(req.content, candidates.map((c) => c.quote)).located;
  }, [req, candidates]);

  async function onConfirm() {
    const user = getCurrentUser();
    if (!user || !candidates) return;
    const issues = candidates
      .map((c) => ({ title: c.title.trim(), quote: c.quote.trim() }))
      .filter((c) => c.title.length > 0);
    if (issues.length === 0) {
      setConfirmError("제목이 있는 이슈가 1개 이상 있어야 합니다.");
      return;
    }
    setConfirming(true);
    setConfirmError(null);
    try {
      const savedIssues = await confirmIssueSplit(projectId, requirementId, { userId: user.id, issues });

      // 확정하자마자 산출물 4종을 미리 만들어 둔다 — getArtifact는 저장된 게
      // 없으면 그 자리에서 AI 초안을 만들어 저장하므로, 여기서 한 번씩 불러
      // 두면 artifacts/[reqId]에서 카드를 눌렀을 때 다시 기다릴 필요가 없다.
      const total = savedIssues.length * ARTIFACT_TYPES.length;
      setGenerateProgress({ done: 0, total });
      await Promise.all(
        savedIssues.flatMap((iss) =>
          ARTIFACT_TYPES.map((t) =>
            getArtifact(projectId, requirementId, iss.issueKey, t, user.id)
              .catch(() => undefined) // 하나 실패해도 나머지는 계속 — 다음에 열람할 때 다시 시도된다.
              .finally(() => setGenerateProgress((p) => (p ? { ...p, done: p.done + 1 } : p))),
          ),
        ),
      );

      router.push(`/projects/${projectId}/artifacts/${requirementId}`);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "이슈 확정에 실패했습니다.");
      setConfirming(false);
      setGenerateProgress(null);
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

  if (req.state !== "CONFIRMED") {
    return (
      <div className="appshell">
        <Header projectName={project.name} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <div className="body">
          {sidebarOpen && <ProjectSidebar projectId={project.id} projectName={project.name} active="artifacts" />}
          <main className="main">
            <div className="crumb">
              <Link href={`/projects/${project.id}/artifacts`}>
                <b>산출물</b>
              </Link>{" "}
              / {req.reqKey} / 이슈 나누기
            </div>
            <p className="lmsg err" style={{ marginTop: 16, maxWidth: 640 }}>
              확정된 요구사항만 이슈로 나눌 수 있습니다. 지금 상태: {req.stateLabel}
            </p>
            <Link className="btn" href={`/projects/${project.id}/requirements/${req.id}`}>
              요구사항으로 돌아가기
            </Link>
          </main>
        </div>
      </div>
    );
  }

  if (!candidates) {
    return (
      <div className="appshell">
        <Header projectName={project.name} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <div className="body">
          {sidebarOpen && <ProjectSidebar projectId={project.id} projectName={project.name} active="artifacts" />}
          <main className="main">
            <div className="placeholder">🤖 AI가 이슈 경계를 분석하는 중…</div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="appshell">
      <Header projectName={project.name} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="body">
        {sidebarOpen && <ProjectSidebar projectId={project.id} projectName={project.name} active="artifacts" />}
        <main className="main">
          <div className="crumb">
            <Link href={`/projects/${project.id}/artifacts`}>
              <b>산출물</b>
            </Link>{" "}
            / <Link href={`/projects/${project.id}/artifacts/${requirementId}`}>{req.reqKey}</Link> / 이슈 나누기
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🧩 이슈로 나누기</h1>
            {engine && (
              <span
                className="lbl"
                style={{ padding: "2px 11px", background: "var(--surface-muted)", color: "var(--muted)" }}
              >
                {ENGINE_LABEL[engine] ?? engine}
              </span>
            )}
            <span className="tagv">🏷 v{req.version}</span>
          </div>

          {/* AI에게 물어보기 — 확정본 수정 화면 1단계와 같은 자리. 선택 입력. */}
          <div className="wcard" style={{ marginTop: 16, maxWidth: 1320 }}>
            <div className="wcb">
              <div className="fieldlab" style={{ marginTop: 0 }}>
                AI에게 물어보기 <span style={{ fontWeight: 400, color: "var(--faint)", fontSize: 11.5 }}>· 선택 입력</span>
              </div>
              <textarea
                className="reqta"
                style={{ minHeight: 56 }}
                value={aiReason}
                onChange={(e) => setAiReason(e.target.value)}
                placeholder="예: 알람 재할당과 우선순위 통일은 별도 이슈로 나눠줘."
              />
              <div className="wfoot" style={{ paddingTop: 10 }}>
                <button className="btn sm" onClick={onRegenerate} disabled={regenerating}>
                  {regenerating ? "나누는 중…" : "🤖 AI로 다시 나누기"}
                </button>
              </div>
              {regenError && (
                <p className="lmsg err" style={{ marginTop: 8, marginBottom: 0 }}>
                  {regenError}
                </p>
              )}
            </div>
          </div>

          {/* 확정본(왼쪽) → 화살표 → 이슈 후보(오른쪽). 밑으로 죽 이어붙이던 걸
              좌우로 바꿔서, 원문의 어느 구절이 어느 이슈가 됐는지 한눈에 맞춰
              보기 쉽게 한다 — 후보 구절마다 다른 색 형광펜 ↔ 같은 색 카드. */}
          <div className="splitgrid" style={{ marginTop: 16, maxWidth: 1320 }}>
            <div className="wcard readonly">
              <div className="wch">
                📄 확정본 v{req.version}
                {candidates.length > 0 && (
                  <span className="rt" style={{ fontSize: 11.5, fontWeight: 500, color: "var(--faint)" }}>
                    형광펜 = 이슈 경계 · 번호를 오른쪽 카드와 맞춰 보세요
                  </span>
                )}
              </div>
              <div className="wcb">
                <HighlightedRequirement content={req.content} candidates={candidates} active={active} onActive={setActive} />
              </div>
            </div>

            <div className="splitarrow" aria-hidden="true">
              ➜
            </div>

            {/* 이슈 후보 카드 — 나누기·합치기 버튼 대신 삭제·추가만 둔다. 합치려면
                한쪽 구절을 복사해 다른 쪽에 붙여넣고 남는 카드를 삭제하면 되고,
                나누려면 "이슈 추가"로 빈 카드를 만든 뒤 원래 카드에서 일부를
                잘라 옮기면 된다 — 사람이 직접 복사·붙여넣기로 하는 편이 자동
                나누기/합치기보다 결과를 예측하기 쉽다. */}
            <div className="issue-list">
              {candidates.map((c, i) => {
                const color = PALETTE[i % PALETTE.length];
                return (
                  <div
                    key={c.clientId}
                    className={`issue-card${active === i ? " on" : ""}`}
                    style={{ "--m": color.m, "--ms": color.ms } as CSSProperties}
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                  >
                    <div className="ibody">
                      <div className="ttl">
                        <span className="no2">{i + 1}</span>
                        <input
                          value={c.title}
                          onChange={(e) => updateCandidate(c.clientId, { title: e.target.value })}
                          placeholder="이슈 제목"
                        />
                        <button className="idel" onClick={() => removeCandidate(c.clientId)} aria-label="이슈 삭제">
                          ✕
                        </button>
                      </div>
                      <textarea
                        className="quotein"
                        value={c.quote}
                        onChange={(e) => updateCandidate(c.clientId, { quote: e.target.value })}
                        placeholder="이 이슈가 커버하는 요구사항 구절 — 직접 써도 됩니다"
                      />
                      {c.quote.trim() && !located[i] && (
                        <span className="nospan" style={{ marginTop: 6, display: "inline-block" }}>
                          원문에서 위치를 찾지 못함
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              <button type="button" className="addrow" onClick={addCandidate}>
                ＋ 이슈 추가 — 나누려면 원래 카드 내용 일부를 잘라 여기로 옮기세요
              </button>
            </div>
          </div>

          {confirmError && (
            <p className="lmsg err" style={{ marginTop: 16, maxWidth: 1320 }}>
              {confirmError}
            </p>
          )}
          {generateProgress && (
            <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 16, marginBottom: 0, maxWidth: 1320 }}>
              🤖 이슈 {generateProgress.total / ARTIFACT_TYPES.length}건의 산출물 초안을 미리 만드는 중…{" "}
              {generateProgress.done}/{generateProgress.total}
            </p>
          )}
          <div className="wfoot" style={{ marginTop: generateProgress ? 8 : 16, maxWidth: 1320 }}>
            <button className="btn prim" onClick={onConfirm} disabled={confirming}>
              {generateProgress
                ? `산출물 만드는 중… (${generateProgress.done}/${generateProgress.total})`
                : confirming
                  ? "확정 중…"
                  : "확정"}
            </button>
            <Link
              className="btn"
              href={`/projects/${project.id}/artifacts/${requirementId}`}
              style={confirming ? { pointerEvents: "none", opacity: 0.5 } : undefined}
            >
              취소
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
