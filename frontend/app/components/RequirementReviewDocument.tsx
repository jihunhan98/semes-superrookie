"use client";
import {useEffect,useRef} from "react";
import type {Finding,ProposalDecision} from "../lib/api";
import {placeholders} from "../lib/review/edits.mjs";
import ReviewIcon from "./ReviewIcon";
import styles from "./RequirementReviewDocument.module.css";

type Range={id:number;start:number;end:number;kind:string};
type Props={baseline:string;content:string;findings:Finding[];choices:Record<number,ProposalDecision>;ranges:Range[];selectedId:number|null;onSelect:(id:number)=>void;reqKey:string;error?:string|null};
function DocumentText({value,ranges,selectedId,onSelect,numbers}:{value:string;ranges:Range[];selectedId:number|null;onSelect:Props['onSelect'];numbers:Map<number,number>}){
 const slots=placeholders(value);
 const safe=ranges.filter(r=>r.start>=0&&r.end>=r.start&&r.end<=value.length);
 const edges=[...new Set([0,value.length,...safe.flatMap(r=>[r.start,r.end]),...slots.flatMap(r=>[r.start,r.end])])].sort((a,b)=>a-b);
 return <>{edges.map((start,i)=>{
   const end=edges[i+1]??start;
   const covering=safe.filter(r=>r.start<=start&&r.end>=end&&r.start!==r.end);
   const range=covering.find(r=>r.id===selectedId)??covering.find(r=>['ai','manual'].includes(r.kind))??covering[0];
   const slot=slots.some(r=>r.start<=start&&r.end>=end);
   const removed=safe.filter(r=>r.start===start&&r.end===start&&['ai','manual'].includes(r.kind));
   return <span key={start}>{removed.map(r=><button type="button" key={r.id} data-review-id={r.id} className={`${styles.mark} ${styles.deletion} ${r.id===selectedId?styles.selected:''}`} onClick={()=>onSelect(r.id)} title="원문 구절이 삭제된 위치">{numbers.get(r.id)} · 삭제됨</button>)}{start!==end&&(range?<button type="button" data-review-id={range.id} onClick={()=>onSelect(range.id)} className={`${styles.mark} ${styles[range.kind]} ${range.id===selectedId?styles.selected:''} ${slot?styles.placeholder:''}`} title={`${numbers.get(range.id)}번 검토 항목 보기`}><span className={styles.number} aria-hidden="true">{start===range.start?numbers.get(range.id):''}</span>{value.slice(start,end)}</button>:<span className={slot?styles.placeholder:undefined}>{value.slice(start,end)}</span>)}</span>;
 })}</>;
}
export default function RequirementReviewDocument({baseline,content,findings,choices,ranges,selectedId,onSelect,reqKey,error}:Props){
 const source=useRef<HTMLDivElement>(null),result=useRef<HTMLDivElement>(null);
 const numbers=new Map(findings.map((f,i)=>[f.id,i+1]));
 const sourceRanges=findings.filter(f=>f.spanStart!=null&&f.spanEnd!=null&&baseline.slice(f.spanStart,f.spanEnd)===f.targetSpan).map(f=>({id:f.id,start:f.spanStart!,end:f.spanEnd!,kind:'pending'}));
 useEffect(()=>{
   for(const ref of [source,result]){
     const box=ref.current,mark=box?.querySelector<HTMLElement>(`[data-review-id="${selectedId}"]`);
     if(box&&mark)box.scrollTo({top:box.scrollTop+mark.getBoundingClientRect().top-box.getBoundingClientRect().top-70,behavior:'smooth'});
   }
 },[selectedId,content,baseline]);
 const chosen=selectedId===null?undefined:choices[selectedId];
 return <section id="review-document" className={styles.document} aria-label="원문과 최종 본문 비교">
 <header className={styles.heading}><div><span className={styles.icon}><ReviewIcon name="file" size={20}/></span><div><h2>본문에서 변경 내용 확인</h2><p>강조된 구절을 누르면 해당 AI 제안으로 연결됩니다.</p></div></div><span className={styles.reqKey}>{reqKey}</span></header>
 <div className={styles.toolbar}><div className={styles.legend}><span><i className={styles.pending}/>검토할 원문</span><span><i className={styles.ai}/>AI 제안 반영</span><span><i className={styles.manual}/>직접 수정 반영</span></div><span className={styles.current} role="status">{selectedId===null?'선택한 검토 항목 없음':`${numbers.get(selectedId)}번 · ${chosen?.action==='APPLY'?'AI 제안 반영됨':chosen?.action==='EDIT'?'직접 수정 반영됨':chosen?.action==='EXCLUDE'?'원문 유지':'아직 반영하지 않았습니다'}`}</span></div>
 <div className={styles.columns}><section className={styles.panel}><header><h3>분석한 원문</h3><span>수정 전 · 검토 위치 강조</span></header><div ref={source} className={styles.body} data-review-document="source" tabIndex={0}><DocumentText value={baseline} ranges={sourceRanges} selectedId={selectedId} onSelect={onSelect} numbers={numbers}/></div></section><section className={`${styles.panel} ${styles.final}`}><header><h3>확정할 최종 본문</h3><span>반영 버튼을 누른 내용만 표시</span></header><div ref={result} className={styles.body} data-review-document="result" tabIndex={0}><DocumentText value={content} ranges={ranges} selectedId={selectedId} onSelect={onSelect} numbers={numbers}/></div></section></div>
 {error&&<p className={styles.error} role="alert">{error}</p>}
 <footer><ReviewIcon name="info" size={14}/><span>AI 제안 반영하기 또는 직접 수정한 문장 반영 버튼으로 본문을 수정합니다. 원문 유지는 본문을 바꾸지 않습니다.</span></footer>
 </section>;
}
