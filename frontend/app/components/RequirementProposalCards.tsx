"use client";
import {useEffect,useState} from "react";
import type {Finding,ProposalDecision} from "../lib/api";
import ReviewIcon from "./ReviewIcon";
import styles from "./RequirementProposalCards.module.css";

type Props={findings:Finding[];choices:Record<number,ProposalDecision>;selectedId:number|null;onSelect:(id:number)=>void;onChange:(id:number,decision:ProposalDecision)=>void;onDirtyChange:(dirty:boolean)=>void;disabled:boolean};
export default function RequirementProposalCards({findings,choices,selectedId,onSelect,onChange,onDirtyChange,disabled}:Props){
 const [editors,setEditors]=useState<Record<number,string>>({});
 const dirty=Object.entries(editors).some(([id,text])=>choices[Number(id)]?.action!=='EDIT'||choices[Number(id)].replacement!==text);
 useEffect(()=>onDirtyChange(dirty),[dirty,onDirtyChange]);
 function closeEditor(id:number){setEditors(prev=>{const next={...prev};delete next[id];return next;});}
 function commit(id:number,d:ProposalDecision){onChange(id,d);closeEditor(id);}
 if(!findings.length)return <section className={styles.empty} role="status"><span className={styles.emptyIcon}><ReviewIcon name="check" size={25}/></span><h2>변경을 제안할 항목이 없습니다.</h2><p>AI 검토를 완료했습니다. 현재 본문에서 수정할 항목이 발견되지 않았습니다.<br/>아래 본문을 확인하고 고객 합의를 기록해주세요.</p></section>;
 const index=Math.max(0,findings.findIndex(f=>f.id===selectedId));
 const f=findings[index],d=choices[f.id],excluded=d?.action==='EXCLUDE',editing=Object.prototype.hasOwnProperty.call(editors,f.id);
 const hasDraft=editing&&!(d?.action==='EDIT'&&d.replacement===editors[f.id]);
 return <div className={styles.list}>
 <nav className={styles.findingNav} aria-label="검토 항목 선택">{findings.map((item,i)=><button type="button" key={item.id} aria-pressed={f.id===item.id} onClick={()=>onSelect(item.id)} className={f.id===item.id?styles.navSelected:''}><span>{String(i+1).padStart(2,'0')}</span>{item.findingType}{Object.prototype.hasOwnProperty.call(editors,item.id)?<small>작성 중</small>:choices[item.id]&&<ReviewIcon name="check" size={13}/>}</button>)}</nav>
 <article data-review-card id={`finding-${f.id}`} className={`${styles.card} ${d?styles.decided:''} ${excluded?styles.excluded:''}`}>
 <header className={styles.header}><div className={styles.identity}><span className={styles.number}>{String(index+1).padStart(2,'0')}</span><div><div className={styles.category}><span>{f.findingType}</span>{f.severity==='BLOCKING'&&<small>상충 확인</small>}</div><span className={styles.subheading}>아래 본문에서 같은 번호의 강조 구절을 확인하세요.</span></div></div><div className={styles.headerActions}><span className={`${styles.status} ${d?styles.statusChosen:''}`}>{d&&<ReviewIcon name="check" size={13}/>}{d?.action==='APPLY'?'AI 제안 반영됨':d?.action==='EDIT'?'직접 수정 반영됨':excluded?'원문 유지':'검토 대기'}</span><a href="#review-document" className={styles.sourceLink}>본문 위치 보기 ↓</a></div></header>
 <div className={styles.comparison}>
 <section className={`${styles.panel} ${styles.source}`}><div className={styles.panelLabel}><ReviewIcon name="file" size={15}/><span>수정할 원문 구절</span><small>본문 {index+1}번</small></div><blockquote>{f.targetSpan}</blockquote>
 <div className={styles.reason}><div className={styles.reasonTitle}><ReviewIcon name="info" size={16}/><h3>왜 변경이 필요한가요?</h3></div><p>{f.reason||'해당 문장의 구현 기준을 확인할 필요가 있습니다.'}</p>{f.interpretations&&<details className={styles.details}><summary>해석 차이와 판단 근거</summary><p>{f.interpretations}</p></details>}</div>
 {f.conflictReqKey&&<div className={styles.conflict}><b><ReviewIcon name="alert" size={14}/>{f.conflictReqKey}와 비교</b><p>{f.conflictQuote}</p></div>}
 </section>
 <section className={`${styles.panel} ${styles.proposal}`}><div className={styles.panelLabel}><ReviewIcon name="sparkles" size={15}/><span>AI 수정 제안</span><small>버튼을 눌러 반영</small></div><h3 className={styles.proposalTitle}>어떻게 변경하면 좋을까요?</h3><p className={styles.guidance}>{f.suggestion}</p>
 {f.proposals?.length?<div className={styles.suggestions}>{f.proposals.map((p,i)=><section className={`${styles.option} ${d?.action==='APPLY'&&d.proposalIndex===i?styles.optionSelected:''}`} key={i}><div className={styles.optionHeading}><span className={styles.optionDot}>{d?.action==='APPLY'&&d.proposalIndex===i&&<ReviewIcon name="check" size={11}/>}</span><b>{p.label}</b></div><p>{p.operation==='DELETE'?'이 구절을 삭제합니다.':p.after}</p><button type="button" className={styles.apply} disabled={disabled} aria-pressed={d?.action==='APPLY'&&d.proposalIndex===i} onClick={()=>commit(f.id,{findingId:f.id,action:'APPLY',proposalIndex:i})}><ReviewIcon name={d?.action==='APPLY'&&d.proposalIndex===i?'check':'arrow'} size={15}/>{d?.action==='APPLY'&&d.proposalIndex===i?'AI 제안 반영됨':'AI 제안 반영하기'}</button></section>)}</div>:<div className={styles.noProposal}><ReviewIcon name="edit" size={18}/><p>완성된 수정안이 없습니다. 변경 이유를 참고해 직접 수정하거나 원문을 유지해주세요.</p></div>}
 </section></div>
 <footer className={styles.actions}><span className={styles.candidate}><ReviewIcon name="info" size={14}/>제안 수치는 적용 전 확인해주세요.</span><div><button type="button" className={`${styles.action} ${editing?styles.actionActive:''}`} disabled={disabled} aria-expanded={editing} onClick={()=>setEditors(prev=>({...prev,[f.id]:prev[f.id]??(d?.action==='EDIT'?d.replacement:f.proposals?.[d?.proposalIndex??0]?.operation==='DELETE'?f.targetSpan:f.proposals?.[d?.proposalIndex??0]?.after)??f.targetSpan??''}))}><ReviewIcon name="edit" size={15}/>직접 수정하기</button><button type="button" className={`${styles.action} ${excluded?styles.actionExcluded:''}`} disabled={disabled} aria-pressed={excluded} onClick={()=>commit(f.id,{findingId:f.id,action:'EXCLUDE'})}><ReviewIcon name="file" size={15}/>원문 유지</button></div></footer>
 {editing&&<div data-proposal-custom className={styles.custom}><label htmlFor={`custom-${f.id}`}><ReviewIcon name="edit" size={15}/>원문 구절을 대신할 문장</label><textarea id={`custom-${f.id}`} rows={4} maxLength={12000} value={editors[f.id]} disabled={disabled} onChange={e=>setEditors(prev=>({...prev,[f.id]:e.target.value}))}/><div className={styles.customActions}><small>{hasDraft?'작성 중 · 반영 버튼을 눌러야 최종 본문이 바뀝니다.':'현재 최종 본문에 반영된 문장입니다.'}</small><button type="button" className={styles.action} disabled={disabled} onClick={()=>closeEditor(f.id)}>취소</button><button type="button" className={styles.apply} disabled={disabled||!editors[f.id].trim()} onClick={()=>commit(f.id,{findingId:f.id,action:'EDIT',replacement:editors[f.id]})}><ReviewIcon name="check" size={15}/>직접 수정한 문장 반영</button></div></div>}
 {excluded&&<div className={styles.excludeNotice}><ReviewIcon name="check" size={15}/>원문을 유지합니다. 이 제안은 최종 본문을 바꾸지 않습니다.</div>}
 </article>
 <div className={styles.pager}><button type="button" className={styles.action} disabled={index===0} onClick={()=>onSelect(findings[index-1].id)}>← 이전 항목</button><span>{index+1} / {findings.length}</span><button type="button" className={styles.action} disabled={index===findings.length-1} onClick={()=>onSelect(findings[index+1].id)}>다음 항목 →</button></div>
 </div>;
}
