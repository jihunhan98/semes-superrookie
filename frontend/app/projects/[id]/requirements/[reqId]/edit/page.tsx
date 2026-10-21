"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../../../components/Header";
import Modal from "../../../../../components/Modal";
import ProjectSidebar from "../../../../../components/ProjectSidebar";
import WorkflowStepper from "../../../../../components/WorkflowStepper";
import RequirementCompare from "../../../../../components/RequirementCompare";
import { placeholders } from "../../../../../lib/review/edits.mjs";
import { confirmRequirement, diffAnalyzeRequirement, getProject, getRequirement, holdRequirement,
  keepReviewFinding, recordReviewEdit, recordConsensus, type ReviewEditDecision, type Finding, type ProjectDetail, type RequirementDetail } from "../../../../../lib/api";
import { getCurrentUser } from "../../../../../lib/session";

const METHODS = ["대면 미팅", "화상회의", "유선", "메일"];
function today() { return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()); }

export default function RequirementEditPage() {
  const router=useRouter(); const params=useParams<{id:string;reqId:string}>();
  const projectId=Number(params.id), requirementId=Number(params.reqId);
  const draftKey=`reqops-review-draft:${projectId}:${requirementId}`;
  const [project,setProject]=useState<ProjectDetail|null>(null);
  const [requirement,setRequirement]=useState<RequirementDetail|null>(null);
  const [draft,setDraft]=useState(""); const [analysisContent,setAnalysisContent]=useState("");
  const [prompt,setPrompt]=useState(""); const [sidebarOpen,setSidebarOpen]=useState(true);
  const [busy,setBusy]=useState(false); const [analyzing,setAnalyzing]=useState(false);
  const [error,setError]=useState<string|null>(null); const [confirmOpen,setConfirmOpen]=useState(false);
  const [method,setMethod]=useState(METHODS[0]); const [contact,setContact]=useState("");
  const [agreedOn,setAgreedOn]=useState(today()); const [agreement,setAgreement]=useState("");
  const [versionTitle,setVersionTitle]=useState("");
  const [blockingDecisionReason,setBlockingDecisionReason]=useState<Record<number,string>>({});

  useEffect(()=>{
    const narrow=window.matchMedia("(max-width:760px)");
    const adapt=()=>{if(narrow.matches)setSidebarOpen(false);};
    adapt();narrow.addEventListener("change",adapt);
    return ()=>narrow.removeEventListener("change",adapt);
  },[]);
  useEffect(()=>{
    const user=getCurrentUser(); if(!user){router.replace("/login");return;}
    Promise.all([getProject(projectId,user.id),getRequirement(projectId,requirementId,user.id)])
      .then(([p,r])=>{
        setProject(p);setRequirement(r);
        const baseline=r.reviewContext?r.aiDraftContent:r.content;
        setAnalysisContent(baseline);
        let text=baseline;
        try { const saved=JSON.parse(sessionStorage.getItem(draftKey)??"null"); if(saved?.source===r.content && typeof saved.text==="string")text=saved.text; } catch{}
        setDraft(text);
        if(r.consensus){setMethod(r.consensus.method);setContact(r.consensus.customerContact);setAgreement(r.consensus.note??"");}
      }).catch(e=>setError(e instanceof Error?e.message:"화면을 불러오지 못했습니다."));
  },[projectId,requirementId,router,draftKey]);
  useEffect(()=>{
    if(!requirement || requirement.reviewContext) return;
    const user=getCurrentUser();if(!user)return;
    let cancelled=false;
    const timer=setInterval(()=>{getRequirement(projectId,requirementId,user.id).then(updated=>{
      if(!cancelled&&updated.reviewContext){setRequirement(updated);setAnalysisContent(updated.aiDraftContent);}
    }).catch(()=>{});},1500);
    return ()=>{cancelled=true;clearInterval(timer);};
  },[requirement?.id,requirement?.reviewContext,projectId,requirementId]);
  function changeDraft(text:string){setDraft(text);if(requirement){try{sessionStorage.setItem(draftKey,JSON.stringify({source:requirement.content,text}));}catch{}}}
  async function analyze(){
    const user=getCurrentUser();if(!user||!draft.trim())return;
    const submitted=draft;setAnalyzing(true);setError(null);
    try{const updated=await diffAnalyzeRequirement(projectId,requirementId,{userId:user.id,content:submitted,reason:prompt.trim()});setRequirement(updated);setAnalysisContent(submitted);setBlockingDecisionReason({});}
    catch(e){setError(e instanceof Error?e.message:"AI 검토에 실패했습니다.");}
    finally{setAnalyzing(false);}
  }
  async function recordEdit(id:number,input:ReviewEditDecision){
    const user=getCurrentUser();if(!user)return;
    setBusy(true);
    try {await recordReviewEdit(projectId,requirementId,id,user.id,input);}finally{setBusy(false);}
  }
  async function keep(f:Finding){
    const user=getCurrentUser();if(!user)return;
    const updated=await keepReviewFinding(projectId,requirementId,f.id,user.id,draft);
    setRequirement(updated);
  }
  async function hold(){const user=getCurrentUser();if(!user)return;setBusy(true);try{await holdRequirement(projectId,requirementId,user.id);router.push(`/projects/${projectId}/requirements/${requirementId}`);}catch(e){setError(e instanceof Error?e.message:"보류하지 못했습니다.");setBusy(false);}}
  const blocking=requirement?.findings.filter(f=>f.severity==="BLOCKING"&&(f.resolutionState==="OPEN"||f.resolutionState==="KEPT"))??[];
  const missing=placeholders(draft).length;
  const context=requirement?.reviewContext;
  const needsReview=!context||draft!==analysisContent||context.status==="FAILED"||context.status==="PARTIAL";
  async function agreeAndConfirm(){
    const user=getCurrentUser();if(!user||!requirement)return;
    if(needsReview){setError("현재 본문으로 AI 재검토를 먼저 실행해주세요.");return;}
    if(missing){setError("본문의 주황색 입력 항목을 모두 채워주세요.");return;}
    if(!contact.trim()||!agreement.trim()||!versionTitle.trim()||!agreedOn){setError("고객 담당자, 합의일, 합의 내용, 변경 요약을 모두 입력하세요.");return;}
    if(blocking.some(f=>!blockingDecisionReason[f.id]?.trim())){setError("남아 있는 필수 확인 항목마다 고객 결정 근거를 입력하세요.");return;}
    setBusy(true);setError(null);
    try{
      const consensus=await recordConsensus(projectId,requirementId,{userId:user.id,method,customerContact:contact.trim(),agreedOn,note:agreement.trim(),agreedContent:draft});
      await confirmRequirement(projectId,requirementId,{userId:user.id,content:draft,title:versionTitle.trim(),consensusId:consensus.consensus?.id,
        decisions:blocking.map(f=>({findingId:f.id,action:"ACCEPT_WITH_REASON",reason:blockingDecisionReason[f.id].trim()}))});
      try{sessionStorage.removeItem(draftKey);}catch{}
      router.push(`/projects/${projectId}/requirements/${requirementId}/issues`);
    }catch(e){setError(e instanceof Error?e.message:"확정하지 못했습니다.");}finally{setBusy(false);}
  }
  if(!project||!requirement)return <div className="appshell"><Header/><main className="main"><p>{error??"요구사항을 불러오는 중…"}</p></main></div>;
  const coverage=context?.status==="COMPLETE"?`기존 요구사항 ${context.comparedCount}/${context.totalCount}건 AI 검토 완료`:context?.status==="RULE_ONLY"?`규칙 검토 완료 · 기존 요구사항 ${context.totalCount}건 전달 · AI 문맥 검토 미완료`:context?.status==="PARTIAL"?`부분 검토 · 기존 요구사항 ${context.comparedCount}/${context.totalCount}건 AI 검토`:"AI 검토를 실행해주세요";
  return <div className="appshell"><Header projectName={project.name} onToggleSidebar={()=>setSidebarOpen(v=>!v)}/><div className="body">
    {sidebarOpen&&<ProjectSidebar projectId={projectId} projectName={project.name} active="requirements"/>}
    <main className="main requirement-review-page compare-review-page"><WorkflowStepper step={2}/>
      <div className="crumb"><Link href={`/projects/${projectId}/requirements`}>요구사항</Link> / <Link href={`/projects/${projectId}/requirements/${requirementId}`}>{requirement.reqKey}</Link> / 검토·수정</div>
      <section className="stage-heading"><div><span className="section-kicker">2단계 · {requirement.reqKey}</span><h1>제안을 비교하고 본문에 반영하세요</h1><p>원문을 유지하거나 제안을 적용한 뒤, 오른쪽에서 최종 내용을 다듬을 수 있습니다.</p></div><button className="btn" onClick={()=>setSidebarOpen(v=>!v)}>{sidebarOpen?"본문 넓게 보기":"메뉴 펼치기"}</button></section>
      <section className="review-prompt"><div><b>추가 검토 요청</b><span>선택 입력</span></div><input disabled={analyzing||busy} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="예: 기존 SOC 기준과 적용 조건을 비교해주세요"/><button className="btn" disabled={analyzing||busy||!draft.trim()} onClick={analyze}>{analyzing?"전체 문맥 검토 중…":"AI 재검토"}</button></section>
      <div className={`compare-coverage ${needsReview?"pending":""}`} role="status"><b>{analyzing?"현재 본문 전체와 기존 요구사항을 검토하고 있습니다.":coverage}</b><span>{draft!==analysisContent?"본문이 변경되었습니다. 수정 후 재검토가 필요합니다.":context?.status==="RULE_ONLY"?"규칙으로 확인할 수 있는 항목만 검토했습니다. 의미에 따른 상충을 모두 확인한 상태는 아닙니다.":"제안 적용은 선택 사항입니다. 직접 수정한 본문은 재검토해도 유지됩니다."}</span></div>
      <RequirementCompare key={`${context?.inputHash??"legacy"}:${requirement.findings.map(f=>f.id).join(",")}`} baseline={analysisContent} value={draft} findings={requirement.findings} onChange={changeDraft} onKeep={keep} onEditDecision={recordEdit} disabled={analyzing||busy} storageKey={`${draftKey}:compare`}/>
      {error&&<p className="lmsg err" role="alert">{error}</p>}
      <footer className="stage-action-bar"><div><b>필수 확인 {blocking.length}건 · 입력 필요 {missing}곳</b><span>{needsReview?"현재 본문으로 재검토한 후 확정할 수 있습니다.":missing?"입력할 값을 채운 뒤 다시 검토해주세요.":`고객 합의 후 v${requirement.nextVersion}으로 확정합니다.`}</span></div><button className="btn" onClick={hold} disabled={busy||analyzing}>보류</button><button className="btn prim" disabled={busy||analyzing||needsReview||missing>0||!draft.trim()} onClick={()=>{setError(null);setConfirmOpen(true);}}>요구사항 확정</button></footer>
    </main></div>
    {confirmOpen&&<Modal title="고객 합의 기록 및 요구사항 확정" icon="✓" wide onClose={()=>!busy&&setConfirmOpen(false)}>
      <div className="consensus-dialog-intro"><b>검토한 현재 본문으로 고객 합의를 기록합니다.</b><span>합의 기록과 최종 본문은 버전 이력에 함께 보존됩니다.</span></div>
      <div className="consensus-dialog-grid"><label><span>합의 방법</span><select value={method} onChange={e=>setMethod(e.target.value)}>{METHODS.map(m=><option key={m}>{m}</option>)}</select></label><label><span>고객 담당자</span><input value={contact} onChange={e=>setContact(e.target.value)}/></label><label><span>합의일</span><input type="date" value={agreedOn} onChange={e=>setAgreedOn(e.target.value)}/></label><label className="wide"><span>합의 내용</span><textarea rows={4} value={agreement} onChange={e=>setAgreement(e.target.value)}/></label>
      {blocking.map(f=><label key={f.id} className="wide"><span>필수 확인 항목 수용 근거 · {f.findingType}</span><small>{f.reason}</small><textarea rows={3} maxLength={1000} value={blockingDecisionReason[f.id]??""} onChange={e=>setBlockingDecisionReason({...blockingDecisionReason,[f.id]:e.target.value})} placeholder="이 항목을 유지하기로 한 고객 결정과 후속 조치를 적어주세요"/></label>)}
      <label className="wide"><span>변경 요약 · 버전 이력 제목</span><input maxLength={200} value={versionTitle} onChange={e=>setVersionTitle(e.target.value)}/></label></div>
      <div className="consensus-snapshot"><span>합의할 본문</span><p>{draft}</p></div>{error&&<p className="lmsg err">{error}</p>}
      <div className="modal-actions"><button className="btn" disabled={busy} onClick={()=>setConfirmOpen(false)}>취소</button><button className="btn prim" disabled={busy} onClick={agreeAndConfirm}>{busy?"기록하고 확정하는 중…":"합의 기록 후 확정"}</button></div>
    </Modal>}
  </div>;
}
