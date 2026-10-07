'use client';
import {useEffect,useState} from 'react';
import {insight,devId,type Coverage} from '../lib/insights';
export default function CoveragePanel({projectId,requirementId,userId,revision}:{projectId:number;requirementId:number;userId:number;revision?:string}){
 const [data,setData]=useState<Coverage>({});const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{let active=true;insight<Coverage>(projectId,userId,`coverage/${requirementId}`).then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[projectId,requirementId,userId,revision]);
 async function run(){setBusy(true);setError('');try{setData(await insight<Coverage>(projectId,userId,`coverage/${requirementId}`,'POST'));}catch(e){setError(e instanceof Error?e.message:'검토 실패');}finally{setBusy(false);}}
 return <section className="insight-card coverage-panel"><div className="insight-heading"><div><span className="section-kicker">근거와 완전성</span><h2>요구사항 누락 검토</h2><p>{data.stale?'입력이 변경되었습니다. AI 재검토가 필요해요.':data.checkedAt?(data.approved?'누락·일관성 검토를 통과했습니다.':'확인이 필요한 항목이 있습니다.'):'AI가 요구사항과 이슈, 산출물의 연결을 확인합니다.'}</p></div><button className="btn prim" onClick={run} disabled={busy}>{busy?'AI가 검토 중이에요…':'AI 누락 검토'}</button></div>
 {error&&<p className="lmsg err" role="alert">{error}</p>}{Boolean(data.concerns?.length)&&<ul className="insight-concerns">{data.concerns!.map((c,i)=><li key={i}>{c}</li>)}</ul>}
 {data.atoms?.map((a,i)=><details key={i} className="coverage-atom"><summary><span>{a.kind}</span>{a.quote}<b>{a.issueIds.length?`${a.issueIds.length}개 이슈 연결`:'미연결'}</b></summary><p>{a.reason}</p><div className="evidence-chips">{a.issueIds.map(id=><a key={id} href={`/projects/${projectId}/requirements/${requirementId}/review?issue=${id}`}>{devId(id)}</a>)}</div>{a.artifacts.map((link,j)=><p key={j}><a href={`/projects/${projectId}/requirements/${requirementId}/issues/${link.issueId}/artifacts/${link.type}`}>{devId(link.issueId)} · {link.type}</a> — {link.quote}</p>)}</details>)}
 </section>;
}
