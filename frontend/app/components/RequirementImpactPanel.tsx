"use client";
import {useState} from "react";import {useImpactEvents} from "../lib/hooks/useImpactEvents";import type {ImpactEvent} from "../lib/api/monitoring";
import ImpactComparisonDialog from "./ImpactComparisonDialog";import styles from "./ImpactNotifications.module.css";
export default function RequirementImpactPanel({projectId,requirementId}:{projectId:number;requirementId:number}){
 const inbox=useImpactEvents(projectId,requirementId),archive=useImpactEvents(projectId,requirementId,true);
 const [selected,setSelected]=useState<ImpactEvent|null>(null),[history,setHistory]=useState(false),[showHistory,setShowHistory]=useState(false);
 const latest=archive.events[0];
 return <section className={styles.panel} aria-label="기존 요구사항 영향 분석">
  {inbox.error?<p role="alert">영향 분석 결과를 불러오지 못했습니다. <button className={styles.button} onClick={()=>inbox.reload()}>다시 불러오기</button></p>:inbox.events.map(event=><div className={styles.banner} key={event.id}><div><strong>{event.data.status==='FAILED'?'저장된 요구사항과 기존 요구사항의 비교를 완료하지 못했습니다.':event.data.status==='PARTIAL'?'기존 요구사항 일부를 확인하지 못했습니다.':'다른 요구사항과 함께 확인할 내용이 있습니다.'}</strong><p>기존 {event.data.totalCount}개 중 {event.data.reviewedCount}개 확인 · 영향 검토 {event.data.targets.filter(t=>!['NONE','UNREVIEWED'].includes(t.comparison.relation)).length}개{event.data.status!=='COMPLETE'?' · 영향 없음으로 판정하지 않았습니다.':''}</p></div><button className={styles.primary} onClick={()=>{setSelected(event);setHistory(false);}}>내용 확인</button></div>)}
  {!inbox.error&&!inbox.loading&&!inbox.events.length&&latest&&!latest.stale&&latest.data.status==='COMPLETE'&&latest.data.targets.every(t=>t.comparison.relation==='NONE')&&<p className={styles.quiet}>기존 요구사항 {latest.data.totalCount}개 확인 완료 · 영향 검토 항목 없음</p>}
  {!inbox.error&&!inbox.loading&&!latest&&!archive.loading&&<p className={styles.quiet}>저장된 본문의 영향 분석 결과를 기다리고 있습니다. 등록·AI 다시 분석 후 결과가 표시됩니다.</p>}
  <button type="button" className={styles.historyButton} aria-expanded={showHistory} onClick={()=>setShowHistory(v=>!v)}>영향 분석 기록 {archive.events.length}건 {showHistory?'접기':'보기'}</button>
  {showHistory&&<div className={styles.history}>{archive.error?<p role="alert">{archive.error}</p>:archive.events.map(event=><button className={styles.button} key={event.id} onClick={()=>{setSelected(event);setHistory(true);}}>{event.data.reqKey} · {event.createdAt.replace('T',' ').slice(0,16)} · {event.stale?'이후 내용 변경':event.data.status==='COMPLETE'?'분석 완료':'미확인 대상 있음'}</button>)}</div>}
  <ImpactComparisonDialog projectId={projectId} event={selected} onClose={()=>setSelected(null)} onRead={inbox.markRead} history={history}/>
 </section>;
}
