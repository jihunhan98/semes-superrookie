"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import IncomingIssues from "../../../../../components/IncomingIssues";
import Header from "../../../../../components/Header";
import ProjectSidebar from "../../../../../components/ProjectSidebar";
import WorkflowStepper from "../../../../../components/WorkflowStepper";
import { devId } from "../../../../../lib/identifiers";
import { confirmBundle, retryJob } from "../../../../../lib/api/v2";
import { getProject, getRequirement, listJiraTargets, listJiraIssueLinks, openJiraIssue, type JiraTarget, type JiraIssueLink, type ProjectDetail, type RequirementDetail, type User } from "../../../../../lib/api";
import { useBundle } from "../../../../../lib/hooks/useBundle";
import { getCurrentUser } from "../../../../../lib/session";

const ARTIFACT_LABELS = { voc: "SWVOC", functional: "기능 요구사항", nonfunctional: "비기능 요구사항", "detail-design": "Detail Design" };
export default function ReviewPage() {
  const params = useParams<{ id: string; reqId: string }>(), router = useRouter(), search = useSearchParams();
  const projectId = Number(params.id), requirementId = Number(params.reqId);
  const [user, setUser] = useState<User | null>(null), [project, setProject] = useState<ProjectDetail | null>(null), [requirement, setRequirement] = useState<RequirementDetail | null>(null);
  const [targets, setTargets] = useState<JiraTarget[]>([]), [targetId, setTargetId] = useState<number | null>(null), [links, setLinks] = useState<JiraIssueLink[]>([]);
  const [jiraLoading, setJiraLoading] = useState(true), [jiraError, setJiraError] = useState<string | null>(null), [opening, setOpening] = useState<number | null>(null);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState<string | null>(null), [sidebarOpen, setSidebarOpen] = useState(true);
  const creationInFlight = useRef(false);
  const { data, error, reload } = useBundle(projectId, requirementId, user?.id);
  const target = targets.find(item => item.id === targetId);
  useEffect(() => { const compact = window.matchMedia("(max-width: 760px)"); const sync = () => setSidebarOpen(!compact.matches); sync(); compact.addEventListener("change", sync); return () => compact.removeEventListener("change", sync); }, []);
  useEffect(() => {
    let active = true;
    const current = getCurrentUser(); if (!current) { router.replace("/login"); return; } setUser(current);
    Promise.all([getProject(projectId, current.id), getRequirement(projectId, requirementId, current.id)]).then(([p, r]) => { if (active) { setProject(p); setRequirement(r); } }).catch(cause => { if (active) setNotice(cause.message); });
    setJiraLoading(true); setJiraError(null);
    Promise.all([listJiraTargets(projectId, current.id), listJiraIssueLinks(projectId, requirementId, current.id)]).then(([items, savedLinks]) => {
      if (!active) return; setTargets(items); setLinks(savedLinks);
      let saved = 0; try { saved = Number(sessionStorage.getItem(`reqops:jira-target:${projectId}`)); } catch { /* Storage is optional. */ }
      setTargetId(items.find(item => item.id === saved)?.id ?? items[0]?.id ?? null);
    }).catch(cause => { if (active) setJiraError(cause.message); }).finally(() => { if (active) setJiraLoading(false); });
    return () => { active = false; };
  }, [projectId, requirementId, router]);
  function selectTarget(id: number) { setTargetId(id); setNotice(null); try { sessionStorage.setItem(`reqops:jira-target:${projectId}`, String(id)); } catch { /* Storage is optional. */ } }
  async function createAndOpen(issueId: number) {
    if (!user || !target || creationInFlight.current) return;
    creationInFlight.current = true; setOpening(issueId); setNotice(null);
    // Reserve the tab while handling the click so popup blockers do not drop the Jira page.
    const tab = window.open("about:blank", "_blank"); if (tab) tab.opener = null;
    try {
      const result = await openJiraIssue(projectId, requirementId, issueId, user.id, target.id);
      const expected = new URL(target.baseUrl);
      const url = new URL(result.url);
      if (url.origin !== expected.origin || !url.pathname.startsWith(`${expected.pathname.replace(/\/$/, "")}/browse/`)) throw new Error("Jira 이슈 주소가 등록한 서버와 다릅니다.");
      setLinks(current => [...current.filter(item => item.targetId !== result.targetId || item.devIssueId !== issueId), result]);
      if (tab && !tab.closed) tab.location.replace(result.url);
      setNotice(`${result.jiraIssueKey} ${result.created ? "이슈를 생성했습니다." : "이슈가 이미 연결되어 있습니다."} 아래 Jira 링크에서 확인할 수 있습니다.`);
    } catch (cause) { if (tab && !tab.closed) tab.close(); setNotice(cause instanceof Error ? cause.message : "Jira 이슈를 생성하지 못했습니다."); }
    finally { creationInFlight.current = false; setOpening(null); }
  }
  async function finish() {
    if (!data || !user || busy) return; setBusy(true); setNotice(null);
    try { await confirmBundle(projectId, requirementId, user.id, data.revision, crypto.randomUUID()); await reload(); setNotice("개발 이슈와 산출물을 전체 확정했습니다."); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "전체 확정하지 못했습니다."); }
    finally { setBusy(false); }
  }
  async function retryGeneration() {
    if (!data?.generation || !user || busy) return; setBusy(true); setNotice(null);
    try { await retryJob(data.generation.id, user.id); await reload(); setNotice("실패한 산출물만 다시 생성합니다."); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "재시도하지 못했습니다."); }
    finally { setBusy(false); }
  }
  if (error && !data) return <main className="main"><p className="lmsg err">{error}</p></main>;
  if (!data || !project || !requirement) return <main className="main"><p role="status">산출물을 불러오는 중…</p>{notice && <p className="lmsg err">{notice}</p>}</main>;
  const incomplete = data.state === "GENERATING" || Boolean(data.generation && (data.generation.failed > 0 || data.generation.pending > 0));
  return <div className="appshell"><Header projectName={project.name} onToggleSidebar={() => setSidebarOpen(open => !open)} /><div className="body">{sidebarOpen && <ProjectSidebar projectId={projectId} projectName={project.name} active="artifacts" />}<main className="main review-workspace jira-review-workspace">
    <WorkflowStepper step={4} />
    <section className="review-header"><div><span className="section-kicker">4단계</span><h1>산출물 · Jira 등록</h1><p>{requirement.reqKey} · 확정본 v{requirement.version}</p></div><div className="generation-summary"><div><b>{incomplete ? "산출물 생성 확인 필요" : data.state === "CONFIRMED" ? "전체 확정 완료" : "산출물 생성 완료"}</b><small>{data.generation ? `${data.generation.succeeded}/${data.generation.total} 생성 · 실패 ${data.generation.failed} · 대기 ${data.generation.pending}` : `${data.issues.length}개 이슈 · 산출물 ${data.issues.flatMap(item => item.artifacts).length}개`}</small></div>{Boolean(data.generation?.failed) && <button className="btn sm" disabled={busy} onClick={retryGeneration}>실패만 재시도</button>}</div></section>
    <section className="jira-destination" aria-labelledby="jira-destination-heading"><div><h2 id="jira-destination-heading">등록할 Jira 프로젝트</h2><p>개발 이슈 하나에 산출물 4종을 담아 등록하고, 실제 Jira 이슈 페이지를 새 탭으로 엽니다.</p></div><Link className="btn sm" href={`/projects/${projectId}/settings`}>프로젝트 설정</Link>
      {jiraLoading ? <p role="status">Jira 프로젝트를 불러오는 중…</p> : jiraError ? <p className="lmsg err" role="alert">{jiraError}</p> : targets.length ? <label className="jira-target-select">대상 프로젝트<select aria-label="등록할 Jira 프로젝트" disabled={opening !== null} value={targetId ?? ""} onChange={event => selectTarget(Number(event.target.value))}>{targets.map(item => <option key={item.id} value={item.id}>{item.displayName} ({item.jiraProjectKey}) · {new URL(item.baseUrl).host}</option>)}</select></label> : <p className="jira-settings-empty">프로젝트 설정에서 Jira 프로젝트를 먼저 등록해주세요.</p>}
      {target && <p className="jira-settings-note">{target.baseUrl}{!target.issueTypeId && " · 프로젝트 설정에서 이슈 유형 ID를 입력하면 이슈를 생성할 수 있습니다."}</p>}
      <p className="jira-settings-note">생성 버튼을 누르면 실제 Jira 이슈가 등록됩니다. 이미 연결한 이슈는 다시 생성하지 않고 기존 페이지를 엽니다. 생성 후 변경사항은 자동으로 동기화되지 않습니다.</p>
    </section>
    <section className="jira-review-list" aria-label="개발 이슈와 산출물 목록"><div className="jira-list-heading"><h2>개발 이슈 및 산출물</h2><span>{data.issues.length}개 이슈 · 이슈별 산출물 4종</span></div>
      {!data.issues.length && <p className="placeholder">개발 이슈가 없습니다.</p>}
      {data.issues.map(item => { const linked = links.find(link => link.targetId === targetId && link.devIssueId === item.id); return <article className={`jira-issue-group${String(item.id) === search.get("issue") || item.issueKey === search.get("issueKey") ? " jira-issue-selected" : ""}`} key={item.id}><div className="jira-issue-row"><span className="jira-type-icon" aria-hidden="true">✓</span><div className="jira-row-title"><Link className="jira-text-link" href={`/projects/${projectId}/requirements/${requirementId}/issues/${item.id}`}>{devId(item.id)} · {item.title} →</Link></div>{linked ? <a className="btn prim sm" href={linked.url} target="_blank" rel="noopener noreferrer">{linked.jiraIssueKey} · Jira에서 열기 ↗</a> : <button className="btn prim sm" onClick={() => createAndOpen(item.id)} disabled={!target?.issueTypeId || jiraLoading || opening !== null || incomplete || item.artifacts.length !== 4}>{opening === item.id ? "Jira 이슈 생성 중…" : "Jira 이슈 생성 후 열기 ↗"}</button>}</div><div className="jira-artifact-list">{!linked && <p className="jira-settings-note">{jiraLoading ? "Jira 설정 확인 중" : !target ? "Jira 프로젝트를 설정해주세요." : !target.issueTypeId ? "프로젝트 설정에서 Jira 이슈 유형 ID를 입력해주세요." : incomplete ? "생성이 끝나면 Jira 등록이 가능합니다." : item.artifacts.length !== 4 ? "산출물 4종이 모두 준비되어야 Jira에 등록할 수 있습니다." : "Jira 등록 준비 완료"}</p>}{Object.entries(ARTIFACT_LABELS).map(([type, label]) => <div key={type} className="jira-artifact-row"><span className="jira-document-icon" aria-hidden="true">≡</span><Link href={`/projects/${projectId}/requirements/${requirementId}/issues/${item.id}/artifacts/${type}`}>{label} →</Link><span className="jira-artifact-location">{item.artifacts.some(doc => doc.type === type) ? linked ? "Jira 이슈 설명에 포함" : "생성 시 Jira 이슈 설명에 포함" : "생성 대기"}</span></div>)}</div><IncomingIssues projectId={projectId} requirementId={requirementId} issueId={item.id}/></article>; })}
    </section>
    {error && <p className="lmsg err" role="alert">{error}</p>}{notice && <p className="lmsg" role="status">{notice}</p>}
    {data.state === "CONFIRMED" && <div className="lmsg" role="status">전체 확정이 완료되었습니다. 위 목록에서 확정된 개발 이슈와 산출물을 열어볼 수 있습니다. <Link href={`/projects/${projectId}/artifacts`}>프로젝트 산출물 목록 →</Link></div>}
    <footer className="bundle-confirm-bar"><div><b>ReqOps 산출물 전체 확정</b><span>개별 검토·저장 없이 현재 내용으로 확정합니다. Jira 등록은 위 버튼으로 진행합니다.</span></div><button className="btn prim" disabled={busy || opening !== null || !data.issues.length || data.state === "CONFIRMED" || incomplete} onClick={finish}>{data.state === "CONFIRMED" ? "전체 확정됨" : incomplete ? "생성 완료 대기 중" : busy ? "확정 중…" : "전체 확정"}</button></footer>
  </main></div></div>;
}
