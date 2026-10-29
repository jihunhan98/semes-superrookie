"use client";
import type {Finding,ProposalDecision} from "../lib/api";
export default function RequirementProposalCards({findings,choices,onChange,disabled}:{findings:Finding[];choices:Record<number,ProposalDecision>;onChange:(id:number,decision:ProposalDecision)=>void;disabled:boolean}){
 if(!findings.length)return <section className="proposal-empty" role="status"><h2>변경을 제안할 항목이 없습니다.</h2><p>AI가 현재 분석에서 지적한 내용은 없습니다. 최종 본문을 확인한 뒤 고객 합의를 기록할 수 있습니다.</p></section>;
 return <div className="proposal-cards">{findings.map((f,index)=>{const d=choices[f.id];return <article className={`requirement-proposal-card ${d?.action==='EXCLUDE'?'excluded':''}`} key={f.id}>
 <header><span>{index+1}. {f.findingType}</span><b>{d?.action==='APPLY'?'제안 적용 선택':d?.action==='EDIT'?'직접 수정 선택':d?.action==='EXCLUDE'?'제외 선택':'결정 필요'}</b></header>
 <blockquote>{f.targetSpan}</blockquote>
 <h3>왜 변경이 필요한가요?</h3><p>{f.reason||'해당 문장의 구현 기준을 확인할 필요가 있습니다.'}</p>{f.interpretations&&<p className="proposal-reason-detail">{f.interpretations}</p>}
 {f.conflictReqKey&&<div className="proposal-conflict"><b>비교 요구사항 · {f.conflictReqKey}</b><p>{f.conflictQuote}</p></div>}
 <h3>어떻게 변경하면 좋을까요?</h3><p>{f.suggestion}</p>
 {f.proposals?.length?<div className="proposal-suggestions">{f.proposals.map((p,i)=><section key={i}><b>{p.label}</b><p>{p.operation==='DELETE'?'이 구절을 삭제합니다.':p.after}</p><button type="button" className={`btn ${d?.action==='APPLY'&&d.proposalIndex===i?'prim':''}`} disabled={disabled} aria-pressed={d?.action==='APPLY'&&d.proposalIndex===i} onClick={()=>onChange(f.id,{findingId:f.id,action:'APPLY',proposalIndex:i})}>이 수정안 적용</button></section>)}</div>:<p className="proposal-reason-detail">적용할 완성 문장을 받지 못했습니다. 이유를 참고해 직접 수정하거나 이 항목을 제외해주세요.</p>}
 <small className="proposal-candidate-note">AI가 제안한 수치는 사용자가 확인할 후보입니다. 적용하거나 직접 수정한 내용으로 확정합니다.</small>
 <div className="proposal-choice-actions"><button type="button" className={`btn ${d?.action==='EDIT'?'prim':''}`} disabled={disabled} aria-pressed={d?.action==='EDIT'} onClick={()=>onChange(f.id,{findingId:f.id,action:'EDIT',replacement:d?.replacement??f.proposals?.[0]?.after??f.targetSpan??''})}>직접 수정</button><button type="button" className={`btn ${d?.action==='EXCLUDE'?'selected':''}`} disabled={disabled} aria-pressed={d?.action==='EXCLUDE'} onClick={()=>onChange(f.id,{findingId:f.id,action:'EXCLUDE'})}>이 항목 제외</button></div>
 {d?.action==='EDIT'&&<label className="proposal-custom-text"><span>원문 구절을 대신할 문장</span><textarea rows={4} maxLength={12000} value={d.replacement??''} disabled={disabled} onChange={e=>onChange(f.id,{...d,replacement:e.target.value})}/></label>}
 {d?.action==='EXCLUDE'&&<p className="proposal-excluded-note">원문을 유지하고 이 제안을 적용하지 않습니다. 제외한 결정은 서버에 저장됩니다.</p>}
 </article>;})}</div>;
}
