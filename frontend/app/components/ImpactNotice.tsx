'use client';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {getCurrentUser} from '../lib/session';
import {insight,type Impact} from '../lib/insights';
export default function ImpactNotice(){
 const params=useParams<{id?:string}>();const project=Number(params?.id);
 const [rows,setRows]=useState<Impact[]>([]);const [error,setError]=useState(false);
 useEffect(()=>{const user=getCurrentUser();if(!project||!user)return;let alive=true;let timer:ReturnType<typeof setTimeout>;
 async function poll(){try{const data=await insight<Impact[]>(project,user!.id,'impacts');if(alive){setRows(data);setError(false);}}catch{if(alive)setError(true);}finally{if(alive)timer=setTimeout(poll,7000);}}poll();return()=>{alive=false;clearTimeout(timer);};},[project]);
 if(!project)return null;
 const pending=rows.some(r=>['QUEUED','RUNNING','RETRY_WAIT'].includes(r.status));
 const unread=rows.filter(r=>!r.read&&r.status==='READY'&&r.decisions?.some(d=>d.judgment!=='NONE')).length;
 const failed=rows.some(r=>!r.read&&r.status==='FAILED');
 return <Link href={`/projects/${project}/insights`} className={`impact-notice ${unread?'has-updates':''}`} aria-live="polite">{error?'영향 알림 연결 확인':pending?'AI 영향 분석 중':unread?`변경 영향 ${unread}건`:failed?'영향 분석 실패':'변경 영향'}{unread>0&&<span className="notice-dot"/>}</Link>;
}
