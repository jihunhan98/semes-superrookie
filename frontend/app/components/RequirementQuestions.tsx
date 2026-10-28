"use client";
import {useEffect,useState} from "react";
import type {RefinementView} from "../lib/api";

export default function RequirementQuestions({data,disabled,dirty,loadingMessage,onAnswer,onDefer,storageKey}:{data:RefinementView|null;disabled:boolean;dirty:boolean;loadingMessage?:string;onAnswer:(id:number,answer:string)=>Promise<void>;onDefer:(id:number,note:string)=>Promise<void>;storageKey:string}){
 const [tab,setTab]=useState<"OPEN"|"DEFERRED"|"ANSWERED">("OPEN");
 const [answers,setAnswers]=useState<Record<number,string>>({});const [notes,setNotes]=useState<Record<number,string>>({});
 const [notice,setNotice]=useState("");const [error,setError]=useState("");
 useEffect(()=>{try{const saved=JSON.parse(sessionStorage.getItem(storageKey)??"{}");setAnswers(saved.answers??{});setNotes(saved.notes??{});}catch{}},[storageKey]);
 function save(next:Record<number,string>,nextNotes:Record<number,string>){setAnswers(next);setNotes(nextNotes);try{sessionStorage.setItem(storageKey,JSON.stringify({answers:next,notes:nextNotes}));}catch{}}
 async function answer(id:number){setNotice("");setError("");try{await onAnswer(id,answers[id]??"");const next={...answers};delete next[id];save(next,notes);setNotice("답변을 문장에 반영했습니다. 필요한 추가 질문도 갱신했습니다.");}catch(e){setError(e instanceof Error?e.message:"답변을 반영하지 못했습니다. 입력 내용은 유지됩니다.");}}
 async function defer(id:number){setNotice("");setError("");try{await onDefer(id,notes[id]??data?.questions.find(q=>q.id===id)?.note??"");setNotice("나중에 결정할 항목으로 남겼습니다. ‘추후 결정’에서 다시 답할 수 있습니다.");}catch(e){setError(e instanceof Error?e.message:"보류 상태를 저장하지 못했습니다.");}}
 const questions=data?.questions??[];const current=questions.filter(q=>q.status===tab);
 return <section className="questionnaire" aria-label="AI 확인 질문" aria-busy={!!loadingMessage}><header><span className="section-kicker">본문을 구체화할 질문</span><h2>알고 있는 내용만 답해주세요</h2><p>선택하거나 직접 입력하면 문장을 구체화합니다. 아직 정하지 못했다면 나중에 결정할 항목으로 남겨두세요.</p></header>
 <nav className="question-tabs" aria-label="질문 상태">{([['OPEN','답변할 질문'],['DEFERRED','추후 결정'],['ANSWERED','답변 기록']] as const).map(([key,label])=><button key={key} type="button" className={tab===key?"on":""} onClick={()=>setTab(key)}>{label}<b>{questions.filter(q=>q.status===key).length}</b></button>)}</nav>
 {!loadingMessage&&dirty&&data?.exists&&<p className="question-review-needed">본문 또는 용어 정의가 변경되어 새 검토가 필요합니다. ‘AI 재검토’를 눌러주세요.</p>}
 {!loadingMessage&&!data?.exists&&<div className="question-empty">아직 확인할 질문이 준비되지 않았습니다. ‘AI 재검토’를 실행해주세요.</div>}
 {!loadingMessage&&data?.exists&&data.status==="FAILED"&&<p className="lmsg err">등록 검토를 완료하지 못했습니다. ‘AI 재검토’를 실행해주세요.</p>}
 {!loadingMessage&&data?.exists&&current.length===0&&<div className="question-empty">{tab==="OPEN"?(questions.some(q=>q.status==="DEFERRED")?"현재 답변할 질문은 없습니다. 남긴 항목은 ‘추후 결정’에서 확인할 수 있습니다.":"현재 검토에서 추가로 확인할 질문이 없습니다."):tab==="DEFERRED"?"나중에 결정할 항목이 없습니다.":"아직 반영된 답변이 없습니다."}</div>}
 {current.map((q,index)=><article className={`question-card ${q.status.toLowerCase()}`} key={q.id}><div className="question-number"><span>Q{index+1}</span><small>{q.category}</small></div><h3>{q.question}</h3><details className="question-source"><summary>어느 문장에 대한 질문인가요?</summary><blockquote>{q.sourceText}</blockquote></details>
 {q.status==="ANSWERED"?<><div className="question-answer-record"><b>사용자 답변</b><p>{q.answer}</p></div><div className="question-answer-record"><b>반영한 문장</b><p>{q.replacement}</p></div></>:<>
 {q.options.length>0&&<><div className="question-options">{q.options.map((option,i)=><button key={i} className={answers[q.id]===option?"selected":""} aria-pressed={answers[q.id]===option} type="button" disabled={disabled||dirty} onClick={()=>save({...answers,[q.id]:option},notes)}>{option}</button>)}</div><small className="question-hint">선택지는 답변 후보입니다. 선택한 내용을 수정해서 입력해도 됩니다.</small></>}
 <label className="question-answer-input"><span>답변 직접 입력</span><textarea aria-label={`${q.question} 답변`} maxLength={4000} rows={3} disabled={disabled||dirty} value={answers[q.id]??""} onChange={e=>save({...answers,[q.id]:e.target.value},notes)} placeholder="알고 있는 조건이나 기준을 적어주세요"/></label>
 {q.note&&<p className="question-deferred-note">남긴 메모: {q.note}</p>}
 <details className="question-defer-note"><summary>나중에 결정할 때 참고할 메모</summary><textarea aria-label="추후 결정 메모" maxLength={4000} rows={2} disabled={disabled||dirty} value={notes[q.id]??q.note??""} onChange={e=>save(answers,{...notes,[q.id]:e.target.value})} placeholder="예: 고객 협의 후 대기시간 결정 예정"/></details>
 <div className="question-actions"><button className="btn prim" type="button" disabled={disabled||dirty||!answers[q.id]?.trim()} onClick={()=>answer(q.id)}>답변 반영</button><button className="btn" type="button" disabled={disabled||dirty} onClick={()=>defer(q.id)}>{q.status==="DEFERRED"?"보류 메모 저장":"나중에 결정"}</button></div>
 </>}
 </article>)}
 {notice&&<p className="question-notice" role="status">{notice}</p>}{error&&<p className="lmsg err" role="alert">{error}</p>}
 </section>;
}
