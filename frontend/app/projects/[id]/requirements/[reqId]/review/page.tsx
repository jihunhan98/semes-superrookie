"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Header from "../../../../../components/Header";
import ProjectSidebar from "../../../../../components/ProjectSidebar";
import WorkflowStepper from "../../../../../components/WorkflowStepper";
import AutoGrowTextarea from "../../../../../components/AutoGrowTextarea";
import ReviewDialog from "../../../../../components/ReviewDialog";
import ArtifactReviewForm, { ARTIFACT_LABELS, ARTIFACT_TYPES } from "../../../../../components/ArtifactReviewForm";
import { devId } from "../../../../../lib/identifiers";
import { confirmBundle, retryJob } from "../../../../../lib/api/v2";
import { getProject, getRequirement, updateDevIssue, type ArtifactDetail, type ArtifactTypeSlug, type ProjectDetail, type RequirementDetail, type User } from "../../../../../lib/api";
import { useBundle } from "../../../../../lib/hooks/useBundle";
import { getCurrentUser } from "../../../../../lib/session";
import type { BundleIssue } from "../../../../../lib/types/workflow";

type IssueDraft = Pick<BundleIssue, "title" | "quote" | "symptom" | "improvementReq" | "changeScope" | "constraintsNote" | "beforeState" | "afterState" | "dueOn">;
type Target = "issue" | ArtifactTypeSlug;
function draftOf(issue: BundleIssue): IssueDraft { return { title: issue.title, quote: issue.quote, symptom: issue.symptom, improvementReq: issue.improvementReq, changeScope: issue.changeScope, constraintsNote: issue.constraintsNote, beforeState: issue.beforeState, afterState: issue.afterState, dueOn: issue.dueOn }; }
function IssueField({ label, value, onChange, rows = 2 }: { label: string; value: string | null; onChange: (value: string) => void; rows?: number }) { return <label className="issue-form-field"><span>{label}</span><AutoGrowTextarea aria-label={label} rows={rows} value={value ?? ""} onChange={onChange} /></label>; }
function Status({ confirmed }: { confirmed: boolean }) { return <span className={`jira-status ${confirmed ? "done" : ""}`}>{confirmed ? "검토 완료" : "검토 대기"}</span>; }

export default function ReviewPage() {
  const params = useParams<{ id: string; reqId: string }>(), search = useSearchParams(), router = useRouter();
  const projectId = Number(params.id), requirementId = Number(params.reqId);
  const [user, setUser] = useState<User | null>(null), [project, setProject] = useState<ProjectDetail | null>(null), [requirement, setRequirement] = useState<RequirementDetail | null>(null);
  const [selected, setSelected] = useState<number | undefined>(() => Number(search.get("issue")) || undefined);
  const [target, setTarget] = useState<Target>("issue"), [opened, setOpened] = useState(false);
  const [draft, setDraft] = useState<IssueDraft | null>(null), [baseline, setBaseline] = useState("");
  const [artifactDirty, setArtifactDirty] = useState(false), [artifactBusy, setArtifactBusy] = useState(false), [artifactDoc, setArtifactDoc] = useState<ArtifactDetail | null>(null);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState<string | null>(null), [dialogNotice, setDialogNotice] = useState<string | null>(null), [sidebarOpen, setSidebarOpen] = useState(true);
  const { data, error, reload } = useBundle(projectId, requirementId, user?.id);
  const issue = data?.issues.find(item => item.id === selected) ?? data?.issues.find(item => item.issueKey === search.get("issueKey")) ?? data?.issues[0];
  const dirty = target === "issue" ? draft !== null && JSON.stringify(draft) !== baseline : artifactDirty;
  const processing = busy || artifactBusy;
  const onArtifactSaved = useCallback(() => { void reload(); }, [reload]);
  useEffect(() => {
    const compact = window.matchMedia("(max-width: 760px)");
    const syncSidebar = () => setSidebarOpen(!compact.matches);
    syncSidebar(); compact.addEventListener("change", syncSidebar);
    return () => compact.removeEventListener("change", syncSidebar);
  }, []);


  useEffect(() => {
    let cancelled = false;
    const current = getCurrentUser(); if (!current) { router.replace("/login"); return; } setUser(current);
    Promise.all([getProject(projectId, current.id), getRequirement(projectId, requirementId, current.id)]).then(([p, r]) => { if (!cancelled) { setProject(p); setRequirement(r); } }).catch(cause => { if (!cancelled) setNotice(cause instanceof Error ? cause.message : "화면을 불러오지 못했습니다."); });
    return () => { cancelled = true; };
  }, [projectId, requirementId, router]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (opened && (dirty || processing)) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [opened, dirty, processing]);
  const generation = useMemo(() => { const docs = data?.issues.flatMap(item => item.artifacts) ?? []; const confirmed = docs.filter(item => item.state === "CONFIRMED").length; return { total: docs.length, confirmed }; }, [data]);

  function canLeave() { return !processing && (!dirty || window.confirm("저장하지 않은 수정 내용이 있습니다. 수정 내용을 버리고 이동할까요?")); }
  function openDocument(item: BundleIssue, next: Target) {
    if (opened && !canLeave()) return;
    setSelected(item.id); setTarget(next); setOpened(true); setArtifactDirty(false); setArtifactBusy(false); setArtifactDoc(null); setDialogNotice(null);
    const initial = draftOf(item); setDraft(initial); setBaseline(JSON.stringify(initial));
  }
  function closeDocument() { if (canLeave()) { setOpened(false); setArtifactDirty(false); setDialogNotice(null); } }
  async function saveIssue(confirmed: boolean) {
    if (!user || !issue || !draft || processing) return;
    setBusy(true); setDialogNotice(null);
    try { const saved = await updateDevIssue(projectId, requirementId, issue.id, { userId: user.id, confirmed, ...draft }); const next = draftOf({ ...issue, ...saved }); setDraft(next); setBaseline(JSON.stringify(next)); await reload(); setDialogNotice(confirmed ? "개발 이슈를 저장하고 검토를 완료했습니다." : "개발 이슈를 저장했습니다."); }
    catch (cause) { setDialogNotice(cause instanceof Error ? cause.message : "저장하지 못했습니다."); }
    finally { setBusy(false); }
  }
  async function finish() {
    if (!data || !user || busy) return;
    setBusy(true); setNotice(null);
    try { await confirmBundle(projectId, requirementId, user.id, data.revision, crypto.randomUUID()); await reload(); setNotice("개발 이슈와 산출물 4종을 전체 확정했습니다."); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "전체 확정하지 못했습니다."); }
    finally { setBusy(false); }
  }
  async function retryGeneration() {
    if (!data?.generation || !user) return;
    setBusy(true); setNotice(null);
    try { await retryJob(data.generation.id, user.id); await reload(); setNotice("실패한 산출물만 다시 생성합니다."); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "재시도하지 못했습니다."); }
    finally { setBusy(false); }
  }
  if (error && !data) return <main className="main"><p className="lmsg err">{error}</p></main>;
  if (!data || !project || !requirement) return <main className="main"><div className="placeholder">검토 작업공간을 불러오는 중…</div>{notice && <p className="lmsg err">{notice}</p>}</main>;

  return <div className="appshell"><Header projectName={project.name} onToggleSidebar={() => setSidebarOpen(open => !open)} /><div className="body">{sidebarOpen && <ProjectSidebar projectId={projectId} projectName={project.name} active="artifacts" />}<main className="main review-workspace jira-review-workspace">
    <WorkflowStepper step={4} />
    <section className="review-header"><div><span className="section-kicker">4단계</span><h1>산출물 검토 및 전체 확정</h1><p>{requirement.reqKey} · 확정본 v{requirement.version}</p></div><div className="generation-summary"><div><b>{data.generation?.failed ? "일부 생성 실패" : data.state === "GENERATING" ? "산출물 생성 중" : data.state === "CONFIRMED" ? "전체 확정 완료" : "산출물 검토"}</b><small>{data.generation ? `${data.generation.succeeded}/${data.generation.total} 생성 · 실패 ${data.generation.failed} · 대기 ${data.generation.pending}` : `${generation.total}개 문서 · 검토 완료 ${generation.confirmed}`}</small></div>{Boolean(data.generation?.failed) && <button className="btn sm" onClick={retryGeneration} disabled={busy}>실패만 재시도</button>}</div></section>
    <section className="jira-review-list" aria-label="개발 이슈와 산출물 목록"><div className="jira-list-heading"><h2>개발 이슈 및 산출물</h2><span>{data.issues.length}개 이슈 · 산출물 4종</span></div>
      {data.issues.length === 0 && <p className="placeholder">개발 이슈가 없습니다.</p>}
      {data.issues.map(item => <article className="jira-issue-group" key={item.id}><div className="jira-issue-row"><span className="jira-type-icon" aria-hidden="true">✓</span><div className="jira-row-title"><button className="jira-text-link" onClick={() => openDocument(item, "issue")}>{devId(item.id)}</button><button className="jira-row-name" onClick={() => openDocument(item, "issue")}>{item.title}</button></div><Status confirmed={item.state === "CONFIRMED"} /><button className="btn sm" onClick={() => openDocument(item, "issue")}>상세 검토</button></div><div className="jira-artifact-list">{ARTIFACT_TYPES.map(type => { const artifact = item.artifacts.find(doc => doc.type === type); return <button key={type} className="jira-artifact-row" onClick={() => openDocument(item, type)}><span className="jira-document-icon" aria-hidden="true">≡</span><span>{ARTIFACT_LABELS[type]}</span><Status confirmed={artifact?.state === "CONFIRMED"} /><span className="jira-row-open">열기 ↗</span></button>; })}</div></article>)}
    </section>
    {error && <p className="lmsg err" role="alert">{error}</p>}{notice && <p className="lmsg" aria-live="polite">{notice}</p>}
    <footer className="bundle-confirm-bar"><div><b>개발 이슈와 산출물 4종 검토</b><span>개별 검토·저장 없이 현재 저장된 내용으로 한 번에 확정합니다.</span></div><button className="btn prim" disabled={busy || !data.issues.length || data.state === "CONFIRMED" || data.state === "GENERATING" || Boolean(data.generation && (data.generation.failed > 0 || data.generation.pending > 0))} onClick={finish}>{data.state === "CONFIRMED" ? "전체 확정됨" : data.state === "GENERATING" ? "생성 완료 대기 중" : busy ? "확정 중…" : "전체 확정"}</button></footer>
    {opened && issue && draft && user && <ReviewDialog title={target === "issue" ? draft.title || issue.title : ARTIFACT_LABELS[target]} breadcrumb={`${project.name} / ${devId(issue.id)} / ${target === "issue" ? "개발 이슈" : ARTIFACT_LABELS[target]}`} onClose={closeDocument}>
      <nav className="jira-document-nav" aria-label="검토할 문서">{(["issue", ...ARTIFACT_TYPES] as Target[]).map(next => <button type="button" key={next} aria-current={target === next ? "page" : undefined} disabled={processing} onClick={() => { if (target !== next) openDocument(issue, next); }}>{next === "issue" ? "개발 이슈" : ARTIFACT_LABELS[next]}</button>)}</nav>
      <div className="jira-dialog-grid" key={`${issue.id}-${target}`}><div className="jira-dialog-main">
        {target === "issue" ? <><fieldset className="jira-form-fields" disabled={busy}><div className="jira-issue-fields"><IssueField label="제목" value={draft.title} onChange={title => setDraft({ ...draft, title })} rows={1} /><IssueField label="현상 기록" value={draft.symptom} onChange={symptom => setDraft({ ...draft, symptom })} /><IssueField label="개선 요청사항" value={draft.improvementReq} onChange={improvementReq => setDraft({ ...draft, improvementReq })} /><IssueField label="변경 범위" value={draft.changeScope} onChange={changeScope => setDraft({ ...draft, changeScope })} /><IssueField label="제약 사항" value={draft.constraintsNote} onChange={constraintsNote => setDraft({ ...draft, constraintsNote })} /><IssueField label="변경 전" value={draft.beforeState} onChange={beforeState => setDraft({ ...draft, beforeState })} /><IssueField label="변경 후" value={draft.afterState} onChange={afterState => setDraft({ ...draft, afterState })} /></div></fieldset>{dialogNotice && <p className="lmsg" role="status">{dialogNotice}</p>}<footer className="jira-editor-actions"><span aria-live="polite">{busy ? "저장 중…" : dirty ? "저장하지 않은 변경사항이 있습니다." : "현재 내용을 확인하고 검토를 완료해 주세요."}</span><button className="btn" disabled={busy} onClick={() => saveIssue(false)}>저장</button><button className="btn prim" disabled={busy || !draft.title.trim()} onClick={() => saveIssue(true)}>저장 및 검토 완료</button></footer></>
          : <ArtifactReviewForm key={`${issue.id}-${target}`} projectId={projectId} requirementId={requirementId} issueKey={issue.issueKey} type={target} userId={user.id} onDirtyChange={setArtifactDirty} onBusyChange={setArtifactBusy} onSaved={onArtifactSaved} onDocument={setArtifactDoc} />}
      </div><aside className="jira-details"><section><h3>상세 정보</h3><dl><dt>유형</dt><dd>{target === "issue" ? "개발 이슈" : ARTIFACT_LABELS[target]}</dd><dt>검토 상태</dt><dd><Status confirmed={target === "issue" ? issue.state === "CONFIRMED" : artifactDoc?.state === "CONFIRMED"} />{dirty && <small className="jira-unsaved">수정 중</small>}</dd><dt>관련 요구사항</dt><dd><Link href={`/projects/${projectId}/requirements/${requirementId}`}>{requirement.reqKey}</Link></dd>{target === "issue" && <><dt><label htmlFor="review-due">기한</label></dt><dd><input id="review-due" type="date" disabled={busy} value={draft.dueOn ?? ""} onChange={event => setDraft({ ...draft, dueOn: event.target.value || null })} /></dd></>}<dt>생성일</dt><dd>{issue.createdAt?.slice(0, 10) ?? "—"}</dd>{target !== "issue" && <><dt>최근 수정</dt><dd>{artifactDoc?.updatedAt?.replace("T", " ") ?? "—"}</dd></>}</dl></section><section className="jira-source"><h3>원 요구사항</h3><p>{requirement.content}</p>{issue.quote && <><h4>연결된 원문</h4><blockquote>{issue.quote}</blockquote></>}</section></aside></div>
    </ReviewDialog>}
  </main></div></div>;
}
