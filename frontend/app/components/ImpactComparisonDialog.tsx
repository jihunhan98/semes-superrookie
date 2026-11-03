"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import type {ImpactEvent,ImpactTarget} from "../lib/api/monitoring";
import styles from "./ImpactNotifications.module.css";
export const relationLabel={CONFLICT:"기준 충돌 의심",DEPENDENCY_REVIEW:"영향 검토 필요",NEEDS_REVIEW:"관련 조건 확인",NONE:"영향 없음",UNREVIEWED:"미확인"};
function Quote({text,quote}:{text:string;quote?:string}){const at=quote?text.indexOf(quote):-1;return <div className={styles.fullText}>{at<0?text:<>{text.slice(0,at)}<mark>{quote}</mark>{text.slice(at+quote!.length)}</>}</div>;}
export default function ImpactComparisonDialog({projectId,event,onClose,onRead,history=false}:{projectId:number;event:ImpactEvent|null;onClose:()=>void;onRead:(event:ImpactEvent)=>Promise<void>;history?:boolean}){
 const ref=useRef<HTMLDialogElement>(null),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(event){setSelected(event.data.targets.find(t=>t.comparison.relation!=='NONE')?.reqKey??event.data.targets[0]?.reqKey??'');setError('');if(!ref.current?.open)ref.current?.showModal();}else ref.current?.close();},[event]);
 const target:ImpactTarget|undefined=event?.data.targets.find(t=>t.reqKey===selected)??event?.data.targets[0];
 const c=target?.comparison;
 async function read(){if(!event||busy)return;setBusy(true);setError('');try{await onRead(event);onClose();}catch(e){setError(e instanceof Error?e.message:'읽음 처리하지 못했습니다.');}finally{setBusy(false);}}
 return <dialog ref={ref} className={styles.dialog} aria-labelledby="impact-dialog-title" onCancel={onClose} onClose={onClose}>
  {event&&<div className={styles.dialogFrame}>
   <header className={styles.dialogHeader}><div><span className={styles.eyebrow}>요구사항 영향 비교 · {event.data.kind}</span><h2 id="impact-dialog-title">{event.data.reqKey}와 {target?.reqKey??'기존 요구사항'} 비교</h2></div><button type="button" className={styles.button} onClick={onClose} aria-label="비교 창 닫기">닫기</button></header>
   <div className={styles.dialogBody}>
    {event.stale&&<p className={styles.warning} role="status">이 분석 이후 본문 또는 비교 대상이 바뀌었습니다. 아래는 분석 당시 기록입니다. 수정 화면에서 최신 본문으로 다시 분석해주세요.</p>}
    <div className={styles.compareToolbar}><strong>{c?relationLabel[c.relation]:'비교 대상 없음'}</strong><label>비교 대상 <select aria-label="비교 대상 요구사항" value={selected} onChange={e=>setSelected(e.target.value)}>{event.data.targets.map(t=><option value={t.reqKey} key={t.reqKey}>{t.reqKey} · {relationLabel[t.comparison.relation]}</option>)}</select></label><span>확인 {event.data.reviewedCount} / {event.data.totalCount}</span></div>
    <div className={styles.columns}>
     <section className={styles.document}><header><div><h3>{event.data.reqKey}</h3><span>{event.data.sourceVersion?`v${event.data.sourceVersion}`:'신규 / 초안'} · 분석 입력 본문</span></div><Link className={styles.linkButton} href={`/projects/${projectId}/requirements/${event.requirementId}/edit`} onClick={onClose}>이 요구사항 수정</Link></header><Quote text={event.data.sourceContent} quote={c?.sourceQuote}/></section>
     <section className={styles.document}><header><div><h3>{target?.reqKey??'비교 대상 없음'}</h3><span>{target?.version?`v${target.version}`:'미확정 초안'} · 비교 당시 본문</span></div>{target?.id&&<Link className={styles.linkButton} href={`/projects/${projectId}/requirements/${target.id}/edit`} onClick={onClose}>이 요구사항 수정</Link>}</header><Quote text={target?.content??'다른 요구사항이 아직 없습니다.'} quote={c?.targetQuote}/></section>
    </div>
    <div className={styles.reasonGrid}><section><h3>{c?.relation==='CONFLICT'?'왜 두 기준이 충돌하나요?':'왜 함께 확인해야 하나요?'}</h3><p>{c?.reason??'비교할 기존 요구사항이 없습니다.'}</p>{c?.sameCondition&&<p><b>조건·전제</b> {c.sameCondition}</p>}</section><section className={styles.question}><h3>사용자가 확인하고 고칠 내용</h3><p>{c?.reviewQuestion||'이 비교에서 수정할 항목을 찾지 못했습니다.'}</p><small>AI 판정은 검토 의견입니다. 원문을 확인한 후 수정 화면에서 적용·합의·확정합니다.</small></section></div>
   </div>
   <footer className={styles.dialogFooter}><div>{error?<span role="alert" className={styles.error}>{error}</span>:<span>읽음 처리하면 내 알림 목록에서 사라집니다. 분석 기록은 유지됩니다.</span>}</div><button type="button" className={styles.button} onClick={onClose}>닫기</button>{!history&&<button type="button" className={styles.primary} onClick={read} disabled={busy}>{busy?'처리 중…':'알림 읽음으로 표시'}</button>}</footer>
  </div>}
 </dialog>;
}
