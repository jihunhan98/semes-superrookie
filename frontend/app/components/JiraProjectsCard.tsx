"use client";

import { useEffect, useState, type FormEvent } from "react";
import { deleteJiraTarget, listJiraTargets, saveJiraTarget, type JiraTarget } from "../lib/api";

type Draft = { id: number | null; baseUrl: string; jiraProjectKey: string; displayName: string; issueTypeId: string; expectedRevision?: number };
const empty: Draft = { id: null, baseUrl: "", jiraProjectKey: "", displayName: "", issueTypeId: "" };
export default function JiraProjectsCard({ projectId, userId, isOwner }: { projectId: number; userId: number; isOwner: boolean }) {
  const [targets, setTargets] = useState<JiraTarget[]>([]), [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);
  useEffect(() => { let active = true; listJiraTargets(projectId, userId).then(items => { if (active) setTargets(items); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [projectId, userId]);
  function start(item?: JiraTarget) { setError(null); setNotice(null); setDraft(item ? { ...item, issueTypeId: item.issueTypeId ?? "", expectedRevision: item.revision } : { ...empty, baseUrl: targets[0]?.baseUrl ?? "" }); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!draft || busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await saveJiraTarget(projectId, draft.id, { userId, baseUrl: draft.baseUrl.trim(), jiraProjectKey: draft.jiraProjectKey.trim(), displayName: draft.displayName.trim(), issueTypeId: draft.issueTypeId.trim() || null, expectedRevision: draft.expectedRevision });
      setTargets(current => draft.id === null ? [...current, result] : current.map(item => item.id === result.id ? result : item));
      setDraft(null); setNotice("Jira 프로젝트를 저장했습니다.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "등록 정보를 저장하지 못했습니다."); }
    finally { setBusy(false); }
  }
  async function remove(item: JiraTarget) {
    if (busy || !window.confirm(`${item.displayName}의 등록 정보를 삭제할까요? Jira 프로젝트와 이슈는 삭제되지 않습니다.`)) return;
    setBusy(true); setError(null); setNotice(null);
    try { await deleteJiraTarget(projectId, item.id, userId); setTargets(current => current.filter(target => target.id !== item.id)); if (draft?.id === item.id) setDraft(null); setNotice("등록 정보를 삭제했습니다."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "삭제하지 못했습니다."); }
    finally { setBusy(false); }
  }
  return <section className="setcard jira-project-settings" aria-labelledby="jira-project-heading">
    <div className="jira-settings-heading"><div><h2 id="jira-project-heading">Jira 프로젝트</h2><p>이 ReqOps 프로젝트에서 사용할 Jira 프로젝트를 여러 개 등록합니다.</p></div>{isOwner && <button className="btn prim sm" disabled={busy || loading || Boolean(draft)} onClick={() => start()}>프로젝트 추가</button>}</div>
    {loading && <p role="status">등록 정보를 불러오는 중…</p>}
    {error && <p className="lmsg err" role="alert">{error}</p>}{notice && <p className="lmsg" role="status">{notice}</p>}
    {!loading && !targets.length && !draft && <p className="jira-settings-empty">등록한 Jira 프로젝트가 없습니다.{isOwner ? " 프로젝트 추가를 눌러 등록해주세요." : " 프로젝트 소유자가 등록할 수 있습니다."}</p>}
    <div className="jira-target-list">{targets.map(item => <article className="jira-target-card" key={item.id}><div><b>{item.displayName}</b><span className="jira-project-key">{item.jiraProjectKey}</span><p>{item.baseUrl}</p><small>등록됨 · {item.issueTypeId ? `이슈 유형 ID ${item.issueTypeId}` : "이슈 유형 미설정"}</small></div><div className="jira-target-actions"><a className="btn sm" href={`${item.baseUrl}/projects/${encodeURIComponent(item.jiraProjectKey)}`} target="_blank" rel="noopener noreferrer">Jira 프로젝트 열기 ↗</a>{isOwner && <><button className="btn sm" disabled={busy || Boolean(draft)} onClick={() => start(item)}>수정</button><button className="btn sm" disabled={busy} onClick={() => remove(item)}>삭제</button></>}</div></article>)}</div>
    {draft && <form className="jira-target-form" onSubmit={save}><h3>{draft.id === null ? "Jira 프로젝트 등록" : "등록 정보 수정"}</h3><fieldset disabled={busy}>
      <label>Jira 기본 주소<input required type="url" maxLength={512} value={draft.baseUrl} placeholder="http://jira.example.com:18080" onChange={e => setDraft({ ...draft, baseUrl: e.target.value })} /><small>http:// 또는 https://를 포함해 입력합니다. /jira 같은 기본 경로가 있다면 함께 입력해주세요.</small></label>
      <label>프로젝트 키<input required maxLength={100} pattern="[A-Za-z][A-Za-z0-9_]*" value={draft.jiraProjectKey} placeholder="예: AMR" onChange={e => setDraft({ ...draft, jiraProjectKey: e.target.value.toUpperCase() })} /><small>Jira 이슈 번호에서 숫자 앞에 오는 값입니다. 예: AMR-123 → AMR</small></label>
      <label>표시 이름<input required maxLength={200} value={draft.displayName} placeholder="예: AMR 제어 개발" onChange={e => setDraft({ ...draft, displayName: e.target.value })} /></label>
      <label>이슈 유형 ID <span className="jira-optional">선택</span><input inputMode="numeric" pattern="[0-9]*" maxLength={40} value={draft.issueTypeId} placeholder="예: 10001" onChange={e => setDraft({ ...draft, issueTypeId: e.target.value })} /><small>등록할 때는 비워도 됩니다. 실제 이슈 생성 전에 Jira에서 사용하는 유형 ID를 입력해주세요.</small></label>
    </fieldset><div className="jira-target-actions"><button type="button" className="btn" disabled={busy} onClick={() => { setDraft(null); setError(null); }}>취소</button><button className="btn prim" disabled={busy}>{busy ? "저장 중…" : "저장"}</button></div></form>}
    <p className="jira-settings-note">등록 정보를 저장해도 Jira 프로젝트나 이슈가 생성되지는 않습니다. 실제 연결은 이슈를 생성할 때 확인합니다.</p>
  </section>;
}
