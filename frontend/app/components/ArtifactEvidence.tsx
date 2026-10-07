'use client';
import Link from 'next/link';
type Quality={status?:string;concerns?:string[]};
export default function ArtifactEvidence({content,projectId}:{content:Record<string,unknown>;projectId:number}){
 const extra=content.legacyExtras as {quality?:Quality;codeEvidence?:{id:string;name:string;file:string;line:number;version:string}[]}|undefined;
 const evidence=content.evidence as {field:string;reqKey:string;quote:string}[]|undefined;
 return <section className="insight-card artifact-evidence"><div className="insight-heading"><h2>{extra?.quality?.status==='GROUNDED'?'원문 근거 확인':'AI 재검토가 필요해요'}</h2><Link href={`/projects/${projectId}/insights?tab=code`}>클래스 소스 관리 →</Link></div>{extra?.quality?.concerns?.map((c,i)=><p key={i} className="lmsg err">{c}</p>)}{Array.isArray(extra?.codeEvidence)&&extra!.codeEvidence!.map(e=><p key={e.id}><b>{e.name}</b> · {e.file}:{e.line} · {e.version}</p>)}{Array.isArray(evidence)&&<details><summary>요구사항 근거 {evidence.length}건</summary>{evidence.map((e,i)=><p key={i}><b>{e.reqKey}</b> · {e.field}<br/>{e.quote}</p>)}</details>}</section>;
}
