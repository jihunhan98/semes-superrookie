"use client";
import {useState} from "react";import {useParams} from "next/navigation";
import {useImpactEvents} from "../lib/hooks/useImpactEvents";
import type {ImpactEvent} from "../lib/api/monitoring";
import ImpactComparisonDialog from "./ImpactComparisonDialog";
import styles from "./ImpactNotifications.module.css";
export default function ImpactBell(){const params=useParams<{id?:string}>(),projectId=Number(params?.id);const {events,error,loading,reload,markRead}=useImpactEvents(projectId);const [selected,setSelected]=useState<ImpactEvent|null>(null),[open,setOpen]=useState(false);
 if(!Number.isFinite(projectId)||projectId<=0)return null;
 return <div className={styles.bellWrap}><button type="button" className={styles.bell} onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-controls="impact-inbox">알림 <span aria-label={`읽지 않은 알림 ${events.length}건`}>{events.length}</span></button>
 {open&&<section id="impact-inbox" className={styles.inbox} aria-label="요구사항 영향 알림"><header><h2>요구사항 영향 알림</h2><button className={styles.button} onClick={()=>setOpen(false)}>닫기</button></header>{error?<p role="alert">{error} <button className={styles.button} onClick={()=>reload()}>다시 불러오기</button></p>:loading?<p role="status">알림을 불러오는 중…</p>:!events.length?<p>읽지 않은 알림이 없습니다.</p>:<ul>{events.map(event=><li key={event.id}><button onClick={()=>{setSelected(event);setOpen(false);}}><b>{event.data.reqKey}</b><span>{event.data.status==='COMPLETE'?'다른 요구사항과 함께 확인할 내용이 있습니다.':`기존 요구사항 확인 ${event.data.reviewedCount} / ${event.data.totalCount} · ${event.data.status==='FAILED'?'분석 실패':'일부 미확인'}`}</span><small>{event.createdAt.replace('T',' ').slice(0,16)} · 내용 확인</small></button></li>)}</ul>}</section>}
 <ImpactComparisonDialog projectId={projectId} event={selected} onClose={()=>setSelected(null)} onRead={markRead}/></div>;
}
