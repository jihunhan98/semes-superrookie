"use client";
import Link from "next/link";
import {useEffect,useMemo,useRef,useState} from "react";
import {useParams,useRouter} from "next/navigation";
import ReviewIcon from "../../../../../components/ReviewIcon";
import styles from "../../../../../components/RequirementReviewPage.module.css";
import Header from "../../../../../components/Header";
import ProjectSidebar from "../../../../../components/ProjectSidebar";
import WorkflowStepper from "../../../../../components/WorkflowStepper";
import Modal from "../../../../../components/Modal";
import ConsensusDocumentPreview from "../../../../../components/ConsensusDocumentPreview";
import {hasRequirementChanges} from "../../../../../lib/review/consensus.mjs";
import RequirementReviewDocument from "../../../../../components/RequirementReviewDocument";
import RequirementProposalCards from "../../../../../components/RequirementProposalCards";
import {composeProposals} from "../../../../../lib/review/proposals.mjs";
import {placeholders} from "../../../../../lib/review/edits.mjs";
import {getProject,getRequirement,getRefinement,diffAnalyzeRequirement,completeProposalReview,recordConsensus,confirmRequirement,holdRequirement,type ProjectDetail,type RequirementDetail,type RefinementView,type ProposalDecision} from "../../../../../lib/api";
import {getCurrentUser} from "../../../../../lib/session";
const METHODS=["대면 미팅","화상회의","유선","메일"];
function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
export default function RequirementEditPage(){
 const router=useRouter(),params=useParams<{id:string;reqId:string}>();const projectId=Number(params.id),requirementId=Number(params.reqId);
 const storageKey=`reqops-proposal-review:${projectId}:${requirementId}`;
 const [project,setProject]=useState<ProjectDetail|null>(null),[requirement,setRequirement]=useState<RequirementDetail|null>(null),[refinement,setRefinement]=useState<RefinementView|null>(null);
 const [choices,setChoices]=useState<Record<number,ProposalDecision>>({}),[selectedId,setSelectedId]=useState<number|null>(null),[dirtyDraft,setDirtyDraft]=useState(false);
 const [busy,setBusy]=useState(false),[analyzing,setAnalyzing]=useState(false),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState("");
 const [sidebarOpen,setSidebarOpen]=useState(true),[prompt,setPrompt]=useState(""),[confirmOpen,setConfirmOpen]=useState(false),[readerExpanded,setReaderExpanded]=useState(false);
 const [method,setMethod]=useState(METHODS[0]),[contact,setContact]=useState(""),[agreedOn,setAgreedOn]=useState(today()),[agreement,setAgreement]=useState(""),[versionTitle,setVersionTitle]=useState("");
 const [blockingDecisionReason,setBlockingDecisionReason]=useState<Record<number,string>>({});
 const operation=useRef(0),pending=useRef(false),mounted=useRef(true);
 const baseline=requirement?.aiDraftContent??requirement?.content??"";
 const findings=requirement?.findings??[];
 const composed=useMemo(()=>composeProposals(baseline,findings,choices),[baseline,findings,choices]);
 const draft=composed.content;
 const contentChanged=hasRequirementChanges(requirement?.content??"",draft);
 const reviewed=requirement?.reviewContext?.status==='USER_REVIEWED'&&draft===baseline&&!refinement?.dictionaryChanged;
 const initialAnalysis=!!requirement&&!requirement.reviewContext;
 const loading=initialAnalysis||analyzing;
 const incomplete=!requirement?.reviewContext||requirement.aiEngine==='unavailable'||['FAILED','PARTIAL'].includes(requirement.reviewContext.status);
 const missing=placeholders(draft).length;
 const unresolved=findings.filter(f=>!choices[f.id]||(choices[f.id].action==='EDIT'&&!choices[f.id].replacement?.trim())||(choices[f.id].action==='APPLY'&&!f.proposals?.[choices[f.id].proposalIndex??0])).length;
 const blocking=findings.filter(f=>f.severity==='BLOCKING'&&(f.resolutionState==='OPEN'||f.resolutionState==='KEPT'));
 function accept(r:RequirementDetail,ref:RefinementView,restore=false){
   setRequirement(r);setRefinement(ref);setSelectedId(r.findings[0]?.id??null);setDirtyDraft(false);setBlockingDecisionReason({});
   let next:Record<number,ProposalDecision>={};for(const f of r.findings)if(f.resolutionState==='KEPT')next[f.id]={findingId:f.id,action:'EXCLUDE'};
   if(restore){try{const saved=JSON.parse(sessionStorage.getItem(storageKey)??'null');if(saved?.version===2&&saved.hash===r.reviewContext?.inputHash){next=saved.choices??next;}}catch{}}
   setChoices(next);
 }
 useEffect(()=>{mounted.current=true;const current=getCurrentUser();if(!current){router.replace('/login');return;}
   let cancelled=false;Promise.all([getProject(projectId,current.id),getRequirement(projectId,requirementId,current.id),getRefinement(projectId,requirementId,current.id)]).then(([p,r,ref])=>{if(cancelled)return;setProject(p);accept(r,ref,true);if(r.consensus){setMethod(r.consensus.method);setContact(r.consensus.customerContact);setAgreement(r.consensus.note??'');}}).catch(e=>{if(!cancelled)setError(e.message);});
   return()=>{cancelled=true;mounted.current=false;};
 },[projectId,requirementId,router]);
 useEffect(()=>{if(!requirement||requirement.reviewContext)return;const user=getCurrentUser();if(!user)return;let cancelled=false;
   const timer=setInterval(()=>{if(pending.current)return;const epoch=operation.current;Promise.all([getRequirement(projectId,requirementId,user.id),getRefinement(projectId,requirementId,user.id)]).then(([r,ref])=>{if(!cancelled&&!pending.current&&epoch===operation.current&&r.reviewContext){accept(r,ref);setError(null);}}).catch(e=>{if(!cancelled)setError(e.message);});},1500);
   return()=>{cancelled=true;clearInterval(timer);};
 },[requirement?.id,requirement?.reviewContext,projectId,requirementId]);
 useEffect(()=>{const small=window.matchMedia('(max-width:760px)');if(small.matches)setSidebarOpen(false);},[]);
 useEffect(()=>{if(!requirement?.reviewContext)return;try{sessionStorage.setItem(storageKey,JSON.stringify({version:2,hash:requirement.reviewContext.inputHash,choices}));}catch{}},[choices,requirement?.reviewContext?.inputHash,storageKey]);
 useEffect(()=>{const refresh=()=>{const user=getCurrentUser();if(!user||pending.current)return;const epoch=operation.current;getRefinement(projectId,requirementId,user.id).then(ref=>{if(mounted.current&&!pending.current&&epoch===operation.current)setRefinement(ref);}).catch(()=>{});};window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[projectId,requirementId]);
 async function analyze(){const user=getCurrentUser();if(!user||!draft.trim()||pending.current||dirtyDraft||composed.error)return;operation.current++;pending.current=true;setAnalyzing(true);setError(null);setNotice('');
   try{const r=await diffAnalyzeRequirement(projectId,requirementId,{userId:user.id,content:draft,reason:prompt.trim()});const ref=await getRefinement(projectId,requirementId,user.id);accept(r,ref);window.dispatchEvent(new Event('reqops:glossary-updated'));}
   catch(e){setError(e instanceof Error?e.message:'AI 분석에 실패했습니다.');}finally{pending.current=false;setAnalyzing(false);}
 }
 async function finishReview(){const user=getCurrentUser();if(!user||!requirement?.reviewContext||pending.current||dirtyDraft||composed.error)return;operation.current++;pending.current=true;setBusy(true);setError(null);
   try{const r=await completeProposalReview(projectId,requirementId,{userId:user.id,inputHash:requirement.reviewContext.inputHash,content:draft,manualContent:false,decisions:findings.map(f=>choices[f.id])});const ref=await getRefinement(projectId,requirementId,user.id);accept(r,ref);setNotice('선택한 수정·원문 유지 결정과 최종 본문을 저장했습니다.');await confirmReviewedOrOpen(r,user.id);}
   catch(e){setError(e instanceof Error?e.message:'검토 결정을 저장하지 못했습니다.');}finally{pending.current=false;setBusy(false);}
 }
 async function confirmReviewedOrOpen(r:RequirementDetail,userId:number){
   if(hasRequirementChanges(r.content,r.aiDraftContent)){setReaderExpanded(false);setConfirmOpen(true);return;}
   await confirmRequirement(projectId,requirementId,{userId,content:r.aiDraftContent,title:r.version?'변경 없이 확정':'등록 본문 그대로 확정'});
   try{sessionStorage.removeItem(storageKey);}catch{}
   router.push(`/projects/${projectId}/requirements/${requirementId}/issues`);
 }
 async function continueReviewed(){const user=getCurrentUser();if(!user||!requirement||!reviewed||pending.current||dirtyDraft)return;
   operation.current++;pending.current=true;setBusy(true);setError(null);
   try{await confirmReviewedOrOpen(requirement,user.id);}catch(e){setError(e instanceof Error?e.message:'확정하지 못했습니다.');}finally{pending.current=false;setBusy(false);}
 }
 async function agreeAndConfirm(){const user=getCurrentUser();if(!user||!reviewed)return;
   if(!contact.trim()||!agreement.trim()||!versionTitle.trim()||!agreedOn){setError('고객사·담당자, 합의일, 합의 내용, 변경 요약을 입력해주세요.');return;}
   if(blocking.some(f=>!blockingDecisionReason[f.id]?.trim())){setError('기존 확정 요구사항과 상충하는 항목을 제외한 이유를 입력해주세요.');return;}
   pending.current=true;operation.current++;setBusy(true);setError(null);
   try{const consensus=await recordConsensus(projectId,requirementId,{userId:user.id,method,customerContact:contact.trim(),agreedOn,note:agreement.trim(),agreedContent:draft});await confirmRequirement(projectId,requirementId,{userId:user.id,content:draft,title:versionTitle.trim(),consensusId:consensus.consensus?.id,decisions:blocking.map(f=>({findingId:f.id,action:'ACCEPT_WITH_REASON',reason:blockingDecisionReason[f.id].trim()}))});try{sessionStorage.removeItem(storageKey);}catch{}router.push(`/projects/${projectId}/requirements/${requirementId}/issues`);}
   catch(e){setError(e instanceof Error?e.message:'확정하지 못했습니다.');}finally{pending.current=false;setBusy(false);}
 }
 async function hold(){const user=getCurrentUser();if(!user)return;setBusy(true);try{await holdRequirement(projectId,requirementId,user.id);router.push(`/projects/${projectId}/requirements/${requirementId}`);}catch(e){setError(e instanceof Error?e.message:'보류하지 못했습니다.');}finally{setBusy(false);}}
 const disabledReason=loading?'AI 분석이 끝나면 제안을 확인할 수 있습니다.':incomplete?'AI 분석을 완료하지 못했습니다. 다시 분석해주세요.':refinement?.dictionaryChanged?'용어 정의가 변경되었습니다. 다시 분석해주세요.':requirement?.reviewContext?.status==='USER_REVIEWED'&&!reviewed?'최종 본문이 바뀌었습니다. 현재 본문으로 AI 다시 분석을 실행해주세요.':dirtyDraft?'작성 중인 문장을 반영하거나 취소해주세요.':unresolved?`검토 항목 ${unresolved}건의 AI 제안 반영·직접 수정·원문 유지를 선택해주세요.`:!draft.trim()?'최종 본문을 입력해주세요.':missing?'입력이 필요한 값을 채워주세요.':composed.error?composed.error:'';
 if(!project||!requirement)return <div className="appshell"><Header/><main className="main"><p role={error?'alert':'status'}>{error??'요구사항을 불러오는 중…'}</p></main></div>;
 return <div className="appshell"><Header projectName={project.name} onToggleSidebar={()=>setSidebarOpen(v=>!v)}/><div className="body">{sidebarOpen&&<ProjectSidebar projectId={projectId} projectName={project.name} active="requirements"/>}<main className={`main requirement-review-page proposal-review-page ${styles.page}`}>
 <WorkflowStepper step={2}/><div className="crumb"><Link href={`/projects/${projectId}/requirements`}>요구사항</Link> / {requirement.reqKey} / 검토·수정</div>
 <section className={styles.heading}><div><div className={styles.eyebrow}><span>{requirement.reqKey}</span><i/><ReviewIcon name="sparkles" size={13}/>AI 검토</div><h1>요구사항 검토</h1><p>변경이 필요한 이유를 확인하고, 적용할 수정안을 선택해주세요.</p></div><span className={`${styles.analysisBadge} ${loading?styles.badgeLoading:incomplete?styles.badgeError:''}`}><ReviewIcon name={loading?'clock':'check'} size={14}/>{loading?'분석 중':incomplete?'분석 확인 필요':reviewed?'사용자 검토 완료':'AI 분석 완료'}</span></section>
 <section className={styles.summary} aria-label="검토 현황"><div><span className={`${styles.metricIcon} ${styles.metricBlue}`}><ReviewIcon name="file" size={20}/></span><div><span>검토 항목</span><b>{findings.length}<small>건</small></b></div></div><div><span className={`${styles.metricIcon} ${styles.metricGreen}`}><ReviewIcon name="check" size={20}/></span><div><span>결정 완료</span><b>{reviewed?findings.length:findings.length-unresolved}<small>건</small></b></div></div><div><span className={`${styles.metricIcon} ${styles.metricAmber}`}><ReviewIcon name="clock" size={20}/></span><div><span>확인 필요</span><b>{reviewed?0:unresolved}<small>건</small></b></div></div></section>
 <section className={styles.reanalyze}><span className={styles.reanalyzeIcon}><ReviewIcon name="sparkles" size={18}/></span><label htmlFor="additional-review"><b>추가 검토 요청</b><span>선택 사항</span></label><input id="additional-review" value={prompt} disabled={busy||loading} onChange={e=>setPrompt(e.target.value)} placeholder="예: 매칭 조건과 예외 처리를 중점적으로 검토해주세요"/><button className={styles.secondaryButton} disabled={busy||analyzing||dirtyDraft||!!composed.error||!draft.trim()} onClick={analyze}><ReviewIcon name="refresh" size={15}/>{analyzing?'AI 분석 중…':'AI 다시 분석'}</button></section>
 {loading&&<div className="ai-review-loading" role="status"><span className="ai-review-spinner"/><div><b>AI가 변경이 필요한 이유와 수정안을 분석하고 있습니다.</b><p>동작 조건·수치·판단 기준, 수행 주체·중요 예외, 기존 요구사항과의 상충을 확인합니다. 완료되면 아래에 제안이 표시됩니다.</p></div></div>}
 {!loading&&incomplete&&<p className="lmsg err" role="alert">AI 분석을 완료하지 못했습니다. 입력 내용은 유지됩니다. AI 다시 분석을 실행해주세요.</p>}
 {refinement?.dictionaryChanged&&<p className="lmsg err">용어 정의가 변경되었습니다. 최신 정의로 다시 분석해주세요.</p>}
 {refinement&&refinement.newTermCount>0&&<p className="lmsg">프로젝트 용어를 {refinement.newTermCount}개 정리했습니다. <Link href={`/projects/${projectId}/glossary`}>용어사전 확인</Link></p>}
 {!loading&&requirement.aiEngine==='rule'&&<p className="lmsg">현재는 규칙 검토 결과입니다. AI 문맥 검토 결과가 필요하면 AI 다시 분석을 실행해주세요.</p>}
 <div className={styles.workspace}><section className={styles.reviewColumn}><div className={styles.columnHeading}><div><ReviewIcon name="sparkles" size={17}/><h2>AI 변경 제안</h2><span>{findings.length}</span></div><small>제안을 선택하고 아래 본문에서 변경 결과를 확인하세요</small></div>
 {!loading&&!reviewed&&(!incomplete||findings.length>0)&&<RequirementProposalCards key={`${requirement.reviewContext?.inputHash}:${findings.map(f=>f.id).join(",")}`} findings={findings} choices={choices} selectedId={selectedId} onSelect={setSelectedId} onDirtyChange={setDirtyDraft} onChange={(id,d)=>{setNotice('');setChoices(prev=>({...prev,[id]:d}));}} disabled={busy||incomplete}/>}
 {reviewed&&<div className="proposal-review-saved" role="status"><b>변경 제안 검토를 완료했습니다.</b><p>선택한 수정안과 제외 결정을 저장했습니다. {contentChanged?'변경한 최종 본문으로 고객 합의를 기록합니다.':'등록·기존 확정 본문과 같아 추가 고객 합의 없이 확정할 수 있습니다.'}</p></div>}
 </section>
 <RequirementReviewDocument baseline={baseline} content={draft} findings={findings} choices={choices} ranges={composed.ranges} selectedId={selectedId} onSelect={id=>{setSelectedId(id);document.querySelector('[data-review-card]')?.scrollIntoView({behavior:'smooth',block:'start'});}} reqKey={requirement.reqKey} error={composed.error}/>
 </div>
 {dirtyDraft&&<p className={styles.pendingDraft} role="status">작성 중인 수정 문장이 있습니다. 해당 항목의 ‘직접 수정한 문장 반영’을 누르거나 취소해주세요.</p>}
 {error&&<p className="lmsg err" role="alert">{error}</p>}{notice&&<p className="lmsg" role="status">{notice}</p>}
 <footer className={`stage-action-bar ${styles.actionBar}`}><div className={styles.footerText}><span className={styles.footerCheck}><ReviewIcon name={unresolved&&!reviewed?'clock':'check'} size={19}/></span><div><b>{reviewed?(contentChanged?'고객 합의 후 확정':'본문 변경 없이 확정'):`검토 결정 ${findings.length-unresolved}/${findings.length}`}</b><span>{reviewed?(contentChanged?'합의일과 고객 담당자, 합의 내용을 기록해주세요.':'본문이 바뀌지 않아 추가 고객 합의 없이 다음 단계로 이동합니다.'):disabledReason||(contentChanged?'선택한 내용을 저장하고 고객 합의를 기록합니다.':'등록 본문을 유지하면 추가 고객 합의 없이 확정합니다.')}</span></div></div><button className="btn" disabled={busy||loading} onClick={hold}>보류</button><button className="btn prim" disabled={busy||loading||(!reviewed&&!!disabledReason)} title={reviewed?(contentChanged?'고객 합의를 기록합니다.':'본문 변경 없이 확정합니다.'):disabledReason} onClick={()=>{setError(null);if(reviewed)continueReviewed();else finishReview();}}>{busy?'요구사항 처리 중…':'요구사항 확정'}</button></footer>
 </main></div>
 {confirmOpen&&<Modal title="고객 합의 기록 및 요구사항 확정" wide className={styles.consensusModal} onClose={()=>{if(!busy){setConfirmOpen(false);setReaderExpanded(false);}}}>
 <div className={styles.consensusIntro}><span><ReviewIcon name="check" size={20}/></span><div><b>최종 본문으로 고객 합의 내용을 기록합니다.</b><p>언제, 고객사 누구와, 어떤 방법으로 무엇을 합의했는지 남겨주세요.</p></div></div>
 <div className={`${styles.consensusWorkspace} ${readerExpanded?styles.consensusReading:""}`}><div className={styles.consensusForm} hidden={readerExpanded}><div className={`consensus-dialog-grid ${styles.consensusGrid}`}><label><span>합의 방법</span><select value={method} disabled={busy} onChange={e=>setMethod(e.target.value)}>{METHODS.map(m=><option key={m}>{m}</option>)}</select></label><label><span>고객사·담당자</span><input value={contact} disabled={busy} onChange={e=>setContact(e.target.value)} placeholder="예: 고객사 / 담당자 이름"/></label><label><span>합의일</span><input type="date" value={agreedOn} disabled={busy} onChange={e=>setAgreedOn(e.target.value)}/></label><label className="wide"><span>합의 내용</span><textarea rows={4} value={agreement} disabled={busy} onChange={e=>setAgreement(e.target.value)}/></label>
 {blocking.map(f=><label className="wide" key={f.id}><span>필수 확인 항목 수용 근거 · {f.findingType}</span><small>{f.reason}</small><textarea value={blockingDecisionReason[f.id]??''} maxLength={1000} disabled={busy} onChange={e=>setBlockingDecisionReason(prev=>({...prev,[f.id]:e.target.value}))} placeholder="기존 확정 요구사항과 상충하는 제안을 제외한 고객 합의 근거"/></label>)}
 <label className="wide"><span>변경 요약 · 버전 이력 제목</span><input value={versionTitle} maxLength={200} disabled={busy} onChange={e=>setVersionTitle(e.target.value)}/></label>
 <div className={`wide consensus-attachment ${styles.attachment}`}><span>합의 자료</span><button className="btn" type="button" disabled title="파일 첨부 기능 준비 중"><ReviewIcon name="attachment" size={15}/>파일 첨부</button><small>첨부 기능 준비 중 · 현재는 버튼 UI만 제공됩니다.</small></div></div>
 </div><ConsensusDocumentPreview content={draft} expanded={readerExpanded} onToggle={()=>setReaderExpanded(v=>!v)} disabled={busy}/></div>{error&&<p className="lmsg err" role="alert">{error}</p>}
 <div className={`modal-actions ${styles.consensusActions}`}><button className="btn" disabled={busy} onClick={()=>setConfirmOpen(false)}>취소</button><button className="btn prim" disabled={busy} onClick={agreeAndConfirm}>{busy?'확정 중…':'합의 기록 후 확정'}</button></div>
 </Modal>}</div>;
}
