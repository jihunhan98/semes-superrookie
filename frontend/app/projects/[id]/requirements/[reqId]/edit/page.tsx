"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../../../components/Header";
import Modal from "../../../../../components/Modal";
import ProjectSidebar from "../../../../../components/ProjectSidebar";
import WorkflowStepper from "../../../../../components/WorkflowStepper";
import RequirementQuestions from "../../../../../components/RequirementQuestions";
import ReviewTextEditor, {type ReviewEditorHandle, type TextRange} from "../../../../../components/ReviewTextEditor";
import {changedRange} from "../../../../../lib/review/edits.mjs";
import RequirementCompare from "../../../../../components/RequirementCompare";
import { placeholders } from "../../../../../lib/review/edits.mjs";
import { confirmRequirement, diffAnalyzeRequirement, getProject, getRequirement, holdRequirement,
  getRefinement, answerClarification, deferClarification, type RefinementView,
  keepReviewFinding, recordReviewEdit, recordConsensus, type ReviewEditDecision, type Finding, type ProjectDetail, type RequirementDetail } from "../../../../../lib/api";
import { getCurrentUser } from "../../../../../lib/session";

const METHODS = ["대면 미팅", "화상회의", "유선", "메일"];
function AiLoadingNotice({message}:{message:string}){
  const [seconds,setSeconds]=useState(0);
  useEffect(()=>{setSeconds(0);const timer=setInterval(()=>setSeconds(s=>s+1),1000);return()=>clearInterval(timer);},[message]);
  return <div className="ai-review-loading" role="status" aria-live="polite"><span className="ai-review-spinner" aria-hidden="true"/><div><b>{message}</b><p>완료되면 자동으로 표시됩니다. {seconds>=20?"AI 응답을 기다리고 있습니다. 처리에 시간이 걸리고 있습니다.":"잠시 기다려주세요."}</p></div><span className="ai-review-elapsed" aria-hidden="true">{seconds}초 경과</span></div>;
}
function today() { return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()); }

export default function RequirementEditPage() {
  const router=useRouter(); const params=useParams<{id:string;reqId:string}>();
  const projectId=Number(params.id), requirementId=Number(params.reqId);
  const draftKey=`reqops-review-draft:${projectId}:${requirementId}`;
  const [project,setProject]=useState<ProjectDetail|null>(null);
  const [requirement,setRequirement]=useState<RequirementDetail|null>(null);
  const [refinement,setRefinement]=useState<RefinementView|null>(null);
  const [recovery,setRecovery]=useState<string|null>(null);
  const [recent,setRecent]=useState<TextRange[]>([]);
  const draftEdited=useRef(false);const mainEditor=useRef<ReviewEditorHandle>(null);
  const [draft,setDraft]=useState(""); const [analysisContent,setAnalysisContent]=useState("");
  const [prompt,setPrompt]=useState(""); const [sidebarOpen,setSidebarOpen]=useState(true);
  const [busy,setBusy]=useState(false); const [analyzing,setAnalyzing]=useState(false);
  const [answering,setAnswering]=useState(false);
  const [reviewDialog,setReviewDialog]=useState<"questions"|"findings"|null>(null);
  const [reviewedContent,setReviewedContent]=useState<string|null>(null);
  const promptedReview=useRef<string>("");
  const operation=useRef(0); const operationPending=useRef(false);
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
    Promise.all([getProject(projectId,user.id),getRequirement(projectId,requirementId,user.id),getRefinement(projectId,requirementId,user.id)])
      .then(([p,r,ref])=>{
        setProject(p);setRequirement(r);setRefinement(ref);
        const baseline=r.reviewContext?r.aiDraftContent:r.content;
        setAnalysisContent(baseline);
        let text=ref.exists?ref.content:baseline;
        try { const saved=JSON.parse(sessionStorage.getItem(draftKey)??"null");
          if(saved?.source===r.content && typeof saved.text==="string"){
            if(saved.revision===ref.revision)text=saved.text;
            else if(saved.text!==text)setRecovery(saved.text);
          }
        } catch{}
        draftEdited.current=text!==(ref.exists?ref.content:baseline);setDraft(text);
        if(r.consensus){setMethod(r.consensus.method);setContact(r.consensus.customerContact);setAgreement(r.consensus.note??"");}
      }).catch(e=>setError(e instanceof Error?e.message:"화면을 불러오지 못했습니다."));
  },[projectId,requirementId,router,draftKey]);
  useEffect(()=>{
    if(!requirement || (requirement.reviewContext&&refinement?.exists) || (requirement.reviewContext&&requirement.aiEngine!=="unavailable"))return;
    const user=getCurrentUser();if(!user)return;let cancelled=false;
    const timer=setInterval(()=>{const epoch=operation.current;Promise.all([getRequirement(projectId,requirementId,user.id),getRefinement(projectId,requirementId,user.id)]).then(([updated,ref])=>{
      if(cancelled||operationPending.current||epoch!==operation.current)return;
      if(ref.exists){setRequirement(updated);setRefinement(ref);setAnalysisContent(updated.aiDraftContent);if(!draftEdited.current)setDraft(ref.content);window.dispatchEvent(new Event('reqops:glossary-updated'));}
    }).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:"등록 검토 상태를 불러오지 못했습니다.");});},1500);
    return ()=>{cancelled=true;clearInterval(timer);};
  },[requirement?.id,requirement?.reviewContext,refinement?.exists,projectId,requirementId]);
  useEffect(()=>{
    let cancelled=false;
    const refresh=()=>{const user=getCurrentUser();const epoch=operation.current;if(user&&!operationPending.current)getRefinement(projectId,requirementId,user.id).then(ref=>{if(!cancelled&&epoch===operation.current&&!operationPending.current)setRefinement(ref);}).catch(()=>{});};
    window.addEventListener("focus",refresh);return()=>{cancelled=true;window.removeEventListener("focus",refresh);};
  },[projectId,requirementId]);
  function changeDraft(text:string){setReviewedContent(null);draftEdited.current=true;setDraft(text);if(requirement){try{sessionStorage.setItem(draftKey,JSON.stringify({source:requirement.content,text,revision:refinement?.revision}));}catch{}}}
  function acceptServer(updated:RequirementDetail,ref:RefinementView){
    const change=changedRange(draft,ref.content);setRecent(change.text?[{start:change.start,end:change.start+change.text.length}]:[]);
    setRequirement(updated);setRefinement(ref);setAnalysisContent(updated.aiDraftContent);setDraft(ref.content);draftEdited.current=false;setBlockingDecisionReason({});
    try{sessionStorage.setItem(draftKey,JSON.stringify({source:updated.content,text:ref.content,revision:ref.revision}));}catch{}
    window.dispatchEvent(new Event('reqops:glossary-updated'));
  }
  async function analyze(finalReview=false){
    const user=getCurrentUser();if(!user||!draft.trim())return;setAnalyzing(true);setError(null);operation.current++;operationPending.current=true;
    try{const updated=await diffAnalyzeRequirement(projectId,requirementId,{userId:user.id,content:draft,reason:prompt.trim()});const ref=await getRefinement(projectId,requirementId,user.id);acceptServer(updated,ref);setReviewDialog(finalReview?"findings":ref.questions.some(q=>q.status==="OPEN")?"questions":"findings");}
    catch(e){setError(e instanceof Error?e.message:"AI 검토에 실패했습니다.");}finally{setAnalyzing(false);operationPending.current=false;}
  }
  async function answerQuestion(id:number,answer:string){
    const user=getCurrentUser();if(!user||!refinement)return;setBusy(true);setAnswering(true);setError(null);operation.current++;operationPending.current=true;
    try{const ref=await answerClarification(projectId,requirementId,id,user.id,refinement.revision,answer);const updated=await getRequirement(projectId,requirementId,user.id);acceptServer(updated,ref);}
    finally{setBusy(false);setAnswering(false);operationPending.current=false;}
  }
  async function deferQuestion(id:number,note:string){
    const user=getCurrentUser();if(!user||!refinement)return;setBusy(true);operation.current++;operationPending.current=true;
    try{const ref=await deferClarification(projectId,requirementId,id,user.id,refinement.revision,note);setRefinement(ref);try{sessionStorage.setItem(draftKey,JSON.stringify({source:requirement?.content,text:draft,revision:ref.revision}));}catch{}}
    finally{setBusy(false);operationPending.current=false;}
  }
  async function loadServer(){const user=getCurrentUser();if(!user)return;setBusy(true);try{const [updated,ref]=await Promise.all([getRequirement(projectId,requirementId,user.id),getRefinement(projectId,requirementId,user.id)]);setRecovery(draft);acceptServer(updated,ref);}catch(e){setError(e instanceof Error?e.message:"본문을 다시 불러오지 못했습니다.");}finally{setBusy(false);}}
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
  const openQuestions=refinement?.questions.filter(q=>q.status==="OPEN").length??0;
  const deferredQuestions=refinement?.questions.filter(q=>q.status==="DEFERRED").length??0;
  const initialAnalysis=!!requirement&&!requirement.reviewContext&&!refinement?.exists&&!error;
  const aiLoadingMessage=analyzing?"현재 본문과 용어사전으로 AI가 다시 검토하고 있습니다.":answering?"AI가 답변을 문장에 반영하고 질문과 용어를 다시 정리하고 있습니다.":initialAnalysis?"등록한 요구사항을 AI가 검토하고 질문과 용어를 정리하고 있습니다.":undefined;
  const questionDirty=!refinement?.exists||draft!==refinement.content||!!refinement.dictionaryChanged;
  const needsReview=!context||!refinement?.exists||draft!==analysisContent||!!refinement.dictionaryChanged||context.status==="FAILED"||context.status==="PARTIAL";
  async function agreeAndConfirm(){
    const user=getCurrentUser();if(!user||!requirement)return;
    if(needsReview){setError("현재 본문으로 AI 재검토를 먼저 실행해주세요.");return;}
    if(openQuestions){setError("답변할 질문에 답하거나 나중에 결정할 항목으로 남겨주세요.");return;}
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
  const confirmDisabledReason=reviewedContent!==draft?"AI 검토 결과를 확인하고 검토 완료를 눌러주세요.":aiLoadingMessage?"AI 처리가 끝나면 확정할 수 있습니다.":busy?"저장 중입니다.":!draft.trim()?"본문을 입력해주세요.":missing?`본문의 미입력 표시 ${missing}곳을 채우고 다시 검토해주세요.`:needsReview?"현재 본문과 용어사전으로 AI 재검토를 완료해주세요.":openQuestions>0?`답변할 질문 ${openQuestions}건에 답하거나 추후 결정으로 남겨주세요.`:"";
  useEffect(()=>{
    if(aiLoadingMessage||!refinement?.exists||!context||needsReview)return;
    const key=context.inputHash+":"+requirement?.id;
    if(promptedReview.current===key)return;
    promptedReview.current=key;
    setReviewDialog(current=>current??(openQuestions?"questions":"findings"));
  },[aiLoadingMessage,refinement?.exists,context?.inputHash,needsReview,openQuestions,requirement?.id]);
  if(!project||!requirement)return <div className="appshell"><Header/><main className="main"><p>{error??"요구사항을 불러오는 중…"}</p></main></div>;
  return <div className="appshell"><Header projectName={project.name} onToggleSidebar={()=>setSidebarOpen(v=>!v)}/><div className="body">
    {sidebarOpen&&<ProjectSidebar projectId={projectId} projectName={project.name} active="requirements"/>}
    <main className="main requirement-review-page compare-review-page" aria-busy={!!aiLoadingMessage}><WorkflowStepper step={2}/>
      <div className="crumb"><Link href={`/projects/${projectId}/requirements`}>요구사항</Link> / <Link href={`/projects/${projectId}/requirements/${requirementId}`}>{requirement.reqKey}</Link> / 검토·수정</div>
      <section className="stage-heading"><div><span className="section-kicker">2단계 · {requirement.reqKey}</span><h1>요구사항 검토·수정</h1><p>알고 있는 내용은 답변하고, 아직 정하지 못한 내용은 추후 결정으로 남겨두세요.</p></div><button className="btn" onClick={()=>setSidebarOpen(v=>!v)}>{sidebarOpen?"본문 넓게 보기":"메뉴 펼치기"}</button></section>
      <section className="review-prompt"><div><b>추가 검토 요청</b><span>선택 입력</span></div><input disabled={analyzing||busy} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="예: 기존 SOC 기준과 적용 조건을 비교해주세요"/><button className="btn" disabled={analyzing||busy||initialAnalysis||!draft.trim()} onClick={()=>analyze()}>{analyzing?"전체 문맥 검토 중…":"AI 재검토"}</button></section>
      {aiLoadingMessage&&<AiLoadingNotice message={aiLoadingMessage}/>}

      {refinement&&(refinement.pendingTerms>0||refinement.newTermCount>0)&&<div className="intake-glossary-alert"><div><b>{refinement.newTermCount>0?`새 용어 ${refinement.newTermCount}개를 용어사전에 등록했습니다.`:`확인할 용어가 ${refinement.pendingTerms}개 있습니다.`}</b><span>AI가 유추한 의미입니다. 용어 이름·내용·사용된 요구사항을 확인하고 수정해주세요.</span></div><Link className="btn" href={`/projects/${projectId}/glossary`}>용어 확인하기 →</Link></div>}
      {!aiLoadingMessage&&refinement?.termStatus==="FAILED"&&<p className="lmsg err">AI 용어 추출을 완료하지 못했습니다. 문맥 규칙으로 만든 후보를 확인하거나 AI 재검토를 실행해주세요.</p>}
      {!aiLoadingMessage&&refinement?.dictionaryChanged&&<p className="question-review-needed">용어 정의가 바뀌었습니다. 새 정의를 참고하도록 AI 재검토를 실행해주세요.</p>}
      {recovery&&<div className="intake-recovery"><span>이 탭에 이전 편집 내용이 남아 있습니다.</span><button className="btn sm" disabled={busy||analyzing} onClick={()=>{changeDraft(recovery);setRecovery(null);}}>이전 편집 복원</button><button className="btn sm" onClick={()=>setRecovery(null)}>닫기</button></div>}
      {!aiLoadingMessage&&refinement?.exists&&refinement.content!==analysisContent&&<div className="intake-recovery"><span>다른 창에서 본문이나 질문이 변경되었습니다. 현재 편집은 유지했습니다.</span><button className="btn sm" disabled={busy||analyzing} onClick={loadServer}>서버의 최신 본문 불러오기</button></div>}
      <section className="intake-current-body"><header><div><span className="section-kicker">작성 중인 요구사항</span><h2>요구사항 본문</h2><p>본문을 수정한 뒤 AI 검토를 실행하세요. 필요한 도메인 지식은 팝업에서 질문합니다.</p></div></header><ReviewTextEditor ref={mainEditor} value={draft} ranges={recent} onChange={changeDraft} disabled={busy||!!aiLoadingMessage}/></section>
      {!aiLoadingMessage&&refinement?.exists&&<section className="review-result-summary"><div><b>AI 검토 결과</b><p>{openQuestions?`핵심 질문 ${openQuestions}건에 답하거나 추후 검토로 남겨주세요.`:"질문 답변과 본문을 바탕으로 검토 결과를 확인해주세요."}</p></div><button className="btn prim" disabled={busy} onClick={()=>setReviewDialog(openQuestions?"questions":"findings")}>검토 결과 확인</button></section>}
      <details className="intake-advanced"><summary>원문·수정안 비교해서 직접 편집하기</summary>
      <RequirementCompare key={`${context?.inputHash??"legacy"}:${requirement.findings.map(f=>f.id).join(",")}`} baseline={analysisContent} value={draft} findings={requirement.findings} onChange={changeDraft} onKeep={keep} onEditDecision={recordEdit} disabled={analyzing||busy} storageKey={`${draftKey}:compare`}/>
      </details>
      {error&&<p className="lmsg err" role="alert">{error}</p>}
      <footer className="stage-action-bar"><div><b>답변할 질문 {openQuestions}건 · 추후 결정 {deferredQuestions}건</b><span>{confirmDisabledReason||`추후 결정 항목은 보존하며, 고객 합의 후 v${requirement.nextVersion}으로 확정합니다.`}</span></div><button className="btn" onClick={hold} disabled={busy||analyzing}>보류</button><button className="btn prim" title={confirmDisabledReason||"고객 합의 정보를 입력합니다."} disabled={!!confirmDisabledReason} onClick={()=>{setError(null);setConfirmOpen(true);}}>요구사항 확정</button></footer>
    </main></div>
    {reviewDialog&&<Modal title={reviewDialog==="questions"?"1차 검토 · 도메인 지식 확인":"최종 검토 · 확인이 필요한 항목"} wide onClose={()=>{if(!busy&&!analyzing)setReviewDialog(null);}}>
      {aiLoadingMessage?<AiLoadingNotice message={aiLoadingMessage}/>:reviewDialog==="questions"?<>
        <p>구현과 판단에 필요한 핵심 정보만 확인합니다. 선택지를 누르거나 직접 입력해주세요. 지금 필요하지 않은 질문은 나중에 결정할 수 있습니다.</p>
        <RequirementQuestions data={refinement} disabled={busy} dirty={questionDirty} onAnswer={answerQuestion} onDefer={deferQuestion} storageKey={`${draftKey}:answers`}/>
        <div className="modal-actions"><button className="btn" onClick={()=>setReviewDialog(null)}>본문 수정</button><button className="btn prim" disabled={busy||openQuestions>0} onClick={()=>analyze(true)}>답변과 본문으로 최종 검토</button></div>
      </>:<>
        <p>AI가 지적한 내용과 근거를 확인하세요. 수정할 항목은 본문에서 고친 뒤 재검토하고, 현재 적용하지 않을 제안은 원문 유지로 기록하세요.</p>
        <RequirementCompare key={context?.inputHash} baseline={analysisContent} value={draft} findings={requirement.findings} onChange={changeDraft} onKeep={keep} onEditDecision={recordEdit} disabled={busy||analyzing} storageKey={`${draftKey}:final`}/>
        {!requirement.findings.some(f=>f.resolutionState==="OPEN")&&<p className="question-notice">현재 추가로 지적된 항목이 없습니다. 본문을 확인한 후 검토를 완료해주세요.</p>}
        <div className="modal-actions">{openQuestions>0&&<button className="btn" onClick={()=>setReviewDialog("questions")}>추가 확인 질문에 답변</button>}<button className="btn" onClick={()=>setReviewDialog(null)}>본문으로 돌아가 수정</button><button className="btn prim" disabled={busy||needsReview||openQuestions>0} onClick={()=>{setReviewedContent(draft);setReviewDialog(null);}}>검토 완료</button></div>
      </>}
      {error&&<p className="lmsg err" role="alert">{error}</p>}
    </Modal>}
    {confirmOpen&&<Modal title="고객 합의 기록 및 요구사항 확정" icon="✓" wide onClose={()=>!busy&&setConfirmOpen(false)}>
      <div className="consensus-dialog-intro"><b>검토한 현재 본문으로 고객 합의를 기록합니다.</b>{deferredQuestions>0&&<p>추후 결정 {deferredQuestions}건은 미결정 상태로 남습니다. 기존 요구사항과의 상충 항목은 별도 고객 결정 근거를 입력해주세요.</p>}<span>합의 기록과 최종 본문은 버전 이력에 함께 보존됩니다.</span></div>
      <div className="consensus-dialog-grid"><label><span>합의 방법</span><select value={method} onChange={e=>setMethod(e.target.value)}>{METHODS.map(m=><option key={m}>{m}</option>)}</select></label><label><span>고객 담당자</span><input value={contact} onChange={e=>setContact(e.target.value)}/></label><label><span>합의일</span><input type="date" value={agreedOn} onChange={e=>setAgreedOn(e.target.value)}/></label><label className="wide"><span>합의 내용</span><textarea rows={4} value={agreement} onChange={e=>setAgreement(e.target.value)}/></label>
      {blocking.map(f=><label key={f.id} className="wide"><span>필수 확인 항목 수용 근거 · {f.findingType}</span><small>{f.reason}</small><textarea rows={3} maxLength={1000} value={blockingDecisionReason[f.id]??""} onChange={e=>setBlockingDecisionReason({...blockingDecisionReason,[f.id]:e.target.value})} placeholder="이 항목을 유지하기로 한 고객 결정과 후속 조치를 적어주세요"/></label>)}
      <label className="wide"><span>변경 요약 · 버전 이력 제목</span><input maxLength={200} value={versionTitle} onChange={e=>setVersionTitle(e.target.value)}/></label></div>
      <div className="consensus-snapshot"><span>합의할 본문</span><p>{draft}</p></div>{error&&<p className="lmsg err">{error}</p>}
      <div className="modal-actions"><button className="btn" disabled={busy} onClick={()=>setConfirmOpen(false)}>취소</button><button className="btn prim" disabled={busy} onClick={agreeAndConfirm}>{busy?"기록하고 확정하는 중…":"합의 기록 후 확정"}</button></div>
    </Modal>}
  </div>;
}
