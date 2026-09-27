"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Header from "../../../../../components/Header";
import ProjectSidebar from "../../../../../components/ProjectSidebar";
import WorkflowStepper from "../../../../../components/WorkflowStepper";
import AutoGrowTextarea from "../../../../../components/AutoGrowTextarea";
import { confirmBundle, retryJob } from "../../../../../lib/api/v2";
import { getProject, getRequirement, updateDevIssue, type ProjectDetail, type RequirementDetail, type User } from "../../../../../lib/api";
import { useBundle } from "../../../../../lib/hooks/useBundle";
import { getCurrentUser } from "../../../../../lib/session";
import type { BundleIssue } from "../../../../../lib/types/workflow";

const ARTIFACT_LABEL: Record<string, string> = { voc: "SWVOC", functional: "기능 요구사항", nonfunctional: "비기능 요구사항", "detail-design": "Detail Design" };
type IssueDraft = Pick<BundleIssue, "title" | "quote" | "symptom" | "improvementReq" | "changeScope" | "constraintsNote" | "beforeState" | "afterState" | "dueOn">;
function draftOf(issue: BundleIssue): IssueDraft { return { title: issue.title, quote: issue.quote, symptom: issue.symptom, improvementReq: issue.improvementReq === issue.title ? null : issue.improvementReq, changeScope: issue.changeScope === issue.quote ? null : issue.changeScope, constraintsNote: issue.constraintsNote, beforeState: issue.beforeState, afterState: issue.afterState, dueOn: issue.dueOn }; }
function IssueField({ label, value, onChange, rows = 2 }: { label: string; value: string | null; onChange: (value: string) => void; rows?: number }) { return <label className="issue-form-field"><span>{label}</span><AutoGrowTextarea rows={rows} value={value ?? ""} onChange={onChange} /></label>; }

export default function ReviewPage() {
  const params = useParams<{ id: string; reqId: string }>(); const search = useSearchParams(); const router = useRouter();
  const projectId = Number(params.id); const requirementId = Number(params.reqId);
  const [user, setUser] = useState<User | null>(null); const [project, setProject] = useState<ProjectDetail | null>(null); const [requirement, setRequirement] = useState<RequirementDetail | null>(null);
  const [selected, setSelected] = useState<number | undefined>(() => Number(search.get("issue")) || undefined); const [draft, setDraft] = useState<IssueDraft | null>(null);
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<string | null>(null); const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => { const current = getCurrentUser(); if (!current) { router.replace("/login"); return; } setUser(current); Promise.all([getProject(projectId, current.id), getRequirement(projectId, requirementId, current.id)]).then(([p, r]) => { setProject(p); setRequirement(r); }).catch((error) => setNotice(error instanceof Error ? error.message : "화면을 불러오지 못했습니다.")); }, [projectId, requirementId, router]);
  const { data, error, reload } = useBundle(projectId, requirementId, user?.id);
  const requestedKey = search.get("issueKey"); const issue = data?.issues.find((item) => item.id === selected) ?? data?.issues.find((item) => item.issueKey === requestedKey) ?? data?.issues[0];
  useEffect(() => { if (issue) setDraft(draftOf(issue)); }, [issue]);
  const generation = useMemo(() => { const docs = data?.issues.flatMap((item) => item.artifacts) ?? []; const confirmed = docs.filter((item) => item.state === "CONFIRMED").length; return { total: docs.length, confirmed, draft: docs.length - confirmed }; }, [data]);

  async function saveIssue(confirmed: boolean) { if (!user || !issue || !draft) return; setBusy(true); setNotice(null); try { await updateDevIssue(projectId, requirementId, issue.id, { userId: user.id, confirmed, ...draft }); await reload(); setNotice(confirmed ? "개발 이슈 양식을 확정했습니다." : "개발 이슈를 저장했습니다."); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "저장하지 못했습니다."); } finally { setBusy(false); } }
  async function finish() { if (!data || !user) return; setBusy(true); setNotice(null); try { await confirmBundle(projectId, requirementId, user.id, data.revision, crypto.randomUUID()); await reload(); setNotice("현재 작업 묶음을 전체 확정했습니다."); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "전체 확정하지 못했습니다."); } finally { setBusy(false); } }
  async function retryGeneration() { if (!data?.generation || !user) return; setBusy(true); setNotice(null); try { await retryJob(data.generation.id,user.id); await reload(); setNotice("실패한 산출물만 다시 생성합니다."); } catch(cause) { setNotice(cause instanceof Error?cause.message:"재시도하지 못했습니다."); } finally { setBusy(false); } }

  if (error) return <main className="main"><p className="lmsg err">{error}</p></main>;
  if (!data || !project || !requirement) return <main className="main"><div className="placeholder">검토 작업공간을 불러오는 중…</div></main>;

  return <div className="appshell"><Header projectName={project.name} onToggleSidebar={() => setSidebarOpen((open) => !open)} /><div className="body">{sidebarOpen && <ProjectSidebar projectId={projectId} projectName={project.name} active="artifacts" />}<main className="main review-workspace">
    <WorkflowStepper step={4} />
    <section className="review-header"><div><span className="section-kicker">4단계</span><h1>산출물 검토 및 전체 확정</h1><p>{requirement.reqKey} · 확정본 v{requirement.version}</p></div><div className="generation-summary"><span className={`status-dot ${data.state.toLowerCase()}`} /><div><b>{data.generation?.status === "PARTIAL_FAILED" ? "일부 생성 실패" : data.generation?.status === "FAILED" ? "생성 실패" : data.state === "GENERATING" ? "산출물 생성 중" : data.state === "CONFIRMED" ? "전체 확정 완료" : "검토 가능"}</b><small>{data.generation ? `${data.generation.succeeded}/${data.generation.total} 생성 · 실패 ${data.generation.failed} · 대기 ${data.generation.pending}` : `${generation.total}개 문서 · 확정 ${generation.confirmed} · 초안 ${generation.draft}`}</small></div>{Boolean(data.generation?.failed) && <button className="btn sm" onClick={retryGeneration} disabled={busy}>실패만 재시도</button>}</div></section>
    <div className="review-grid">
      <aside className="review-issues"><div className="review-pane-title"><span>개발 이슈</span><b>{data.issues.length}</b></div>{data.issues.map((item, index) => <button key={item.id} className={issue?.id === item.id ? "on" : ""} onClick={() => setSelected(item.id)}><span className="issue-index">{String(index + 1).padStart(2, "0")}</span><b>개발 이슈 {index + 1}</b><small>산출물 {item.artifacts.filter((a) => a.state === "CONFIRMED").length}/4 확정</small></button>)}</aside>
      <section className="review-body">{issue && draft ? <><div className="review-issue-heading"><div><span className="section-kicker">선택한 항목</span><h2>개발 이슈 {(data.issues.findIndex((item) => item.id === issue.id) + 1)}</h2></div><span className={`issue-state ${issue.state.toLowerCase()}`}>{issue.state === "CONFIRMED" ? "확정" : "작성 중"}</span></div><div className="issue-document-form"><section><h3>문제와 요청</h3><p>현재 상황과 이번에 개선할 내용을 순서대로 확인합니다.</p><IssueField label="현상 기록" value={draft.symptom} onChange={(value) => setDraft({ ...draft, symptom: value })} /><IssueField label="개선 요청사항" value={draft.improvementReq} onChange={(value) => setDraft({ ...draft, improvementReq: value })} /></section><section><h3>영향과 제약</h3><p>수정되는 범위와 반드시 지켜야 할 조건입니다.</p><IssueField label="변경 범위" value={draft.changeScope} onChange={(value) => setDraft({ ...draft, changeScope: value })} /><IssueField label="제약 사항" value={draft.constraintsNote} onChange={(value) => setDraft({ ...draft, constraintsNote: value })} /></section><section><h3>변경 내용</h3><p>변경 전후를 위에서 아래로 이어서 비교합니다.</p><IssueField label="변경 전" value={draft.beforeState} onChange={(value) => setDraft({ ...draft, beforeState: value })} rows={3} /><IssueField label="변경 후" value={draft.afterState} onChange={(value) => setDraft({ ...draft, afterState: value })} rows={3} /></section></div><div className="issue-meta-row"><label>기한<input type="date" value={draft.dueOn ?? ""} onChange={(event) => setDraft({ ...draft, dueOn: event.target.value || null })} /></label><span>생성일 <b>{issue.createdAt?.slice(0, 10) ?? "—"}</b></span><span>해결일 <b>{issue.resolvedAt?.slice(0, 10) ?? "미해결"}</b></span></div><div className="review-save-row"><button className="btn" disabled={busy} onClick={() => saveIssue(false)}>임시 저장</button><button className="btn prim" disabled={busy} onClick={() => saveIssue(true)}>이슈 확정</button></div></> : <div className="placeholder">개발 이슈가 없습니다.</div>}</section>
      <aside className="review-evidence"><div className="review-pane-title"><span>연결 산출물</span><b>4종</b></div>{issue?.artifacts.map((artifact) => <Link key={artifact.id} href={`/projects/${projectId}/requirements/${requirementId}/issues/${issue.id}/artifacts/${artifact.type}`}><span><b>{ARTIFACT_LABEL[artifact.type] ?? artifact.type}</b><small>내용 열어보기</small></span><em className={artifact.state.toLowerCase()}>{artifact.state === "CONFIRMED" ? "확정" : "초안"}</em></Link>)}<div className="requirement-evidence"><span>원 요구사항</span><p>{requirement.content}</p><Link href={`/projects/${projectId}/requirements/${requirementId}`}>확정본과 합의 보기 →</Link></div></aside>
    </div>
    {notice && <p className={notice.includes("못") || notice.includes("없") ? "lmsg err" : "lmsg ok"} aria-live="polite">{notice}</p>}
    <footer className="bundle-confirm-bar"><div><b>모든 내용을 검토했나요?</b><span>개발 이슈와 산출물 4종을 현재 내용으로 함께 확정합니다.</span></div><button className="btn prim" disabled={busy || data.state === "CONFIRMED" || data.state === "GENERATING"} onClick={finish}>{data.state === "CONFIRMED" ? "전체 확정됨" : data.state === "GENERATING" ? "생성 완료 대기 중" : busy ? "확정 중…" : "전체 작업 묶음 확정"}</button></footer>
  </main></div></div>;
}
