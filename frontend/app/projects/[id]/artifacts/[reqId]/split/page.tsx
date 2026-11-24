"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../../../components/Header";
import Modal from "../../../../../components/Modal";
import ProjectSidebar from "../../../../../components/ProjectSidebar";
import { locateSpans } from "../../../../../lib/highlight";
import { ISSUE_PALETTE as PALETTE } from "../../../../../lib/issuePalette";
import {
  confirmIssueSplit,
  getProject,
  getRequirement,
  listDevIssues,
  previewIssueSplit,
  type ProjectDetail,
  type RequirementDetail,
} from "../../../../../lib/api";
import { getCurrentUser } from "../../../../../lib/session";

type Candidate = { clientId: string; issueId?: number; title: string; quote: string };

// ai-model/main.py의 _SPLIT_SYSTEM_PROMPT와 동일하게 유지한다.
const ISSUE_SPLIT_PROMPT = `당신은 VCS/AMR 요구사항을 독립적으로 구현하고 검증할 수 있는 개발 이슈(Jira 티켓)로 나누는 전문가다.
요구사항의 전체 목적과 결과를 먼저 파악한 뒤, 구현을 마쳤을 때 따로 검증할 수 있는 업무 결과를 찾는다.

분할 원칙:
1. 기본값은 이슈 1개다. 서로 다른 시작점과 업무 결과가 있고, 각 결과를 독립적으로 구현·시험·완료할 수 있을 때만 분리한다.
2. 외부 이벤트 수신을 통한 생성과 사용자 메뉴를 통한 수동 생성처럼 진입 경로, 권한 또는 외부 연동 책임, 결과 확인 방법이 달라 각각 완료할 수 있다면 별도 이슈로 만든다.
3. 한 경로를 완성하기 위한 메시지 형식, 입력 필드, 입력 제약, 권한, 상태 확인 가정, 외부 보고 여부는 그 경로의 이슈에 포함한다. 문장 수·화면 수·클래스 수만으로 분리하지 않는다.
4. 서로 떨어져 있는 문장도 같은 경로의 조건이라면 같은 이슈에 포함한다. 원문 순서가 섞여 있다는 이유로 독립된 두 결과를 한 이슈로 합치지 않는다.
5. 각 이슈의 quote에는 그 경로를 가장 잘 대표하는 원문의 연속된 구절 하나를 글자 그대로 넣는다. quote가 하나라고 해서 떨어진 다른 조건을 이슈 범위에서 빼지 않는다. 원문에 없는 구절을 만들거나 서로 다른 구절을 이어 붙이지 않는다.
6. 태스크 저장 같은 공통 내부 구현을 고객에게 독립된 결과로 확인받는 별도 기능처럼 추가하지 않는다.
7. 정의가 필요하다고만 적힌 필드·중복 허용 정책·메시지 값·오류 처리·보고 정책은 임의로 확정하지 않는다. 명시된 수동 생성의 미보고 조건을 외부 이벤트 생성까지 확대하지 않는다.
8. title은 구현할 업무 결과가 보이게 간결하게 작성한다. 원문에 두 결과가 없으면 억지로 2개를 만들지 않는다.

JSON만 반환한다. 설명이나 코드 블록을 붙이지 않는다.
{"issues":[{"title":"구현할 업무 결과","quote":"원문에 실제 등장하는 연속된 대표 구절"}]}`;

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
  const [promptOpen, setPromptOpen] = useState(false);

  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [active, setActive] = useState<number | null>(null);

  const [aiReason, setAiReason] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

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
          if (r.workflow?.bundleState !== "PLANNING") {
            router.replace(`/projects/${projectId}/requirements/${requirementId}/review`);
            return;
          }
          setCandidates(existing.map(i => ({clientId:newClientId(),issueId:i.id,title:i.title,quote:i.quote??""})));
          return;
        } else {
          const preview = await previewIssueSplit(projectId, requirementId, { userId: user.id, reason: "" });
          setCandidates(preview.issues.map((i) => ({ clientId: newClientId(), title: i.title, quote: i.quote })));
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
      const used=new Set<number>();
      setCandidates(preview.issues.map((i,index) => {
        const matches=candidates?.filter(old=>old.issueId&&!used.has(old.issueId)&&(old.quote===i.quote||old.title===i.title))??[];
        const fallback=preview.issues.length===candidates?.length?candidates[index]:undefined;
        const issueId=matches.length===1?matches[0].issueId:fallback?.issueId&&!used.has(fallback.issueId)?fallback.issueId:undefined;
        if(issueId)used.add(issueId);
        return { clientId: newClientId(), issueId, title: i.title, quote: i.quote };
      }));
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
    if (!user || !candidates || !req) return;
    const issues = candidates
      .map((c) => ({ issueId:c.issueId, title: c.title.trim(), quote: c.quote.trim() }))
      .filter((c) => c.title.length > 0);
    if (issues.length === 0) {
      setConfirmError("제목이 있는 이슈가 1개 이상 있어야 합니다.");
      return;
    }
    if (issues.some((issue) => !issue.quote || !req.content.includes(issue.quote))) {
      setConfirmError("모든 이슈의 근거 구절은 확정 요구사항 본문에서 선택해야 합니다.");
      return;
    }
    if (new Set(issues.map((issue) => issue.quote)).size !== issues.length) {
      setConfirmError("같은 근거 구절을 여러 이슈에 중복 연결할 수 없습니다.");
      return;
    }
    setConfirming(true);
    setConfirmError(null);
    try {
      // 산출물 4종은 서버가 확정 직후 백그라운드에서 미리 만들어 둔다(여기서
      // 기다리지 않는다) — 그래서 이 호출이 끝나면 곧장 넘어간다.
      await confirmIssueSplit(projectId, requirementId, { userId: user.id, issues });
      router.push(`/projects/${projectId}/requirements/${requirementId}/review`);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "이슈 확정에 실패했습니다.");
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

  if (req.state !== "CONFIRMED") {
    return (
      <div className="appshell">
        <Header projectName={project.name} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <div className="body">
          {sidebarOpen && <ProjectSidebar projectId={project.id} projectName={project.name} active="artifacts" />}
          <main className="main">
            <div className="crumb">
              <Link href={`/projects/${project.id}/requirements/${req.id}`}>
                <b>{req.reqKey}</b>
              </Link>{" "}
              / 개발 이슈 도출
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
            <div className="placeholder">개발 이슈 범위를 정리하는 중…</div>
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
            <Link href={`/projects/${project.id}/requirements/${requirementId}`}><b>{req.reqKey}</b></Link> / 개발 이슈 도출
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>개발 이슈 도출</h1>
            <button
              type="button"
              className="issue-split-prompt-help"
              title="개발 이슈 분할 프롬프트 확인"
              aria-label="개발 이슈 분할 프롬프트 확인"
              data-tooltip="분할 프롬프트 확인"
              onClick={() => setPromptOpen(true)}
            >
              ?
            </button>
            <span className="tagv">🏷 v{req.version}</span>
          </div>

          {promptOpen && (
            <Modal title="개발 이슈 분할 프롬프트" onClose={() => setPromptOpen(false)} wide>
              <div className="issue-split-prompt-dialog">
                <p>AI가 확정 요구사항을 개발 이슈로 나눌 때 사용하는 기준입니다.</p>
                <h3>AI에 전달하는 시스템 프롬프트</h3>
                <pre className="promptbox">{ISSUE_SPLIT_PROMPT}</pre>
                <h3>함께 전달하는 내용</h3>
                <p>
                  확정 요구사항 본문을 전달합니다. 아래의 AI 재검토 칸에 입력한 내용은 참고 지시로 덧붙이고,
                  같은 프로젝트의 다른 요구사항도 문맥으로 함께 전달합니다.
                </p>
                <p>
                  AI를 사용할 수 없거나 유효한 이슈를 반환하지 않으면, 요구사항 전체를 근거로 한 이슈 1개를 제안합니다.
                </p>
              </div>
            </Modal>
          )}

          {/* 확정본 — 후보 구절마다 다른 색 형광펜. 아래 카드와 번호로 짝지어 본다. */}
          {req.workflow?.bundleState === "PLANNING" && candidates.some(c=>c.issueId) && <p className="lmsg" role="status">이전 개발 이슈를 가져왔습니다. 변경된 근거 구절은 새 확정본에 맞게 고쳐주세요. 유지한 이슈와 산출물은 기존 이력을 이어갑니다.</p>}
          <div className="wcard readonly" style={{ marginTop: 16, maxWidth: 1000 }}>
            <div className="wch">
              📄 확정본 v{req.version}
              {candidates.length > 0 && (
                <span className="rt" style={{ fontSize: 11.5, fontWeight: 500, color: "var(--faint)" }}>
                  형광펜 = 이슈 경계 · 번호를 아래 카드와 맞춰 보세요
                </span>
              )}
            </div>
            <div className="wcb">
              <HighlightedRequirement content={req.content} candidates={candidates} active={active} onActive={setActive} />
            </div>
          </div>

          {/* 개발 이슈 분할안 — 제목과 근거 구절을 직접 수정하거나 이슈를 추가·삭제한다. */}
          <h2 style={{ fontSize: 17, margin: "24px 0 0", maxWidth: 1000 }}>나눠진 개발 이슈</h2>
          <div className="issue-list" style={{ maxWidth: 1000 }}>
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
                      ref={(element) => {
                        if (!element) return;
                        element.style.height = "auto";
                        element.style.height = `${element.scrollHeight}px`;
                      }}
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
              ＋ 이슈 추가
            </button>
          </div>

          {/* AI 프롬프트로 분할안 재검토. */}
          <div className="wcard ai-recheck-card" style={{ marginTop: 16, maxWidth: 1000 }}>
            <div className="wcb">
              <div className="fieldlab" style={{ marginTop: 0 }}>
                AI 프롬프트로 재검토 <span style={{ fontWeight: 400, color: "var(--faint)", fontSize: 11.5 }}>· 선택 입력</span>
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
                  {regenerating ? "AI가 다시 검토 중이에요…" : "AI 재검토"}
                </button>
              </div>
              {regenError && (
                <p className="lmsg err" style={{ marginTop: 8, marginBottom: 0 }}>
                  {regenError}
                </p>
              )}
            </div>
          </div>

          {confirmError && (
            <p className="lmsg err" style={{ marginTop: 16, maxWidth: 1000 }}>
              {confirmError}
            </p>
          )}
          <div className="wfoot" style={{ marginTop: 16, maxWidth: 1000 }}>
            <button className="btn prim" onClick={onConfirm} disabled={confirming}>
              {confirming ? "작업을 시작하는 중…" : "이슈 확정 및 산출물 4종 자동 생성"}
            </button>
            <Link
              className="btn"
              href={`/projects/${project.id}/requirements/${requirementId}`}
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
