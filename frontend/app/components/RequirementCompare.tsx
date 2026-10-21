"use client";
import { useEffect, useRef, useState } from "react";
import type { Finding, ReviewEditDecision } from "../lib/api";
import { changedRange, mapRange, placeholders, prepareEdit, spliceEdit } from "../lib/review/edits.mjs";
import ReviewTextEditor, { MarkedReviewText, type ReviewEditorHandle, type TextRange } from "./ReviewTextEditor";

type Applied = TextRange & { id: number; before: string; after: string; restoreOffset: number; restoreLength: number; proposalIndex: number };
type State = { anchors: Record<number, TextRange>; applied: Applied[]; manual: TextRange[] };
function initial(findings: Finding[], baseline: string, value: string): State {
  const change = changedRange(baseline, value);
  return { anchors: Object.fromEntries(findings.map(f => {
    const range = { start: f.spanStart ?? -1, end: f.spanEnd ?? -1 };
    return [f.id, range.start < 0 ? {...range,stale:true} : baseline === value ? range : mapRange(range,change.start,change.end,change.text.length)];
  })), applied: [], manual: baseline===value?[]:[{start:change.start,end:change.start+change.text.length}] };
}
export default function RequirementCompare({ baseline, value, findings, onChange, onKeep, onEditDecision, disabled, storageKey }: {
  baseline: string; value: string; findings: Finding[]; onChange: (text: string) => void;
  onKeep: (finding: Finding) => Promise<void>; onEditDecision: (id: number, input: ReviewEditDecision) => Promise<void>; disabled: boolean; storageKey: string;
}) {
  const [state, setState] = useState<State>(()=>initial(findings,baseline,value));
  const [selected, setSelected] = useState(findings[0]?.id);
  const [notice, setNotice] = useState(""); const [saving, setSaving] = useState(false);
  const editor = useRef<ReviewEditorHandle>(null); const detail = useRef<HTMLDivElement>(null);
  const finding = findings.find(f=>f.id===selected) ?? findings[0];
  const applied = state.applied.find(a=>a.id===finding?.id);
  const anchor = finding ? state.anchors[finding.id] : undefined;
  useEffect(()=>{
    try { const cached=JSON.parse(sessionStorage.getItem(storageKey)??"null");
      if(cached?.baseline===baseline && cached?.value===value && Array.isArray(cached?.state?.manual)) setState(cached.state);
    } catch { /* A draft is usable even when browser storage is unavailable. */ }
    // Each analysis mounts a fresh comparison; restoring is only needed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function save(next: State, text: string) {
    setState(next); onChange(text);
    try { sessionStorage.setItem(storageKey,JSON.stringify({baseline,value:text,state:next})); } catch { /* optional local draft */ }
  }
  function remap(start: number, end: number, length: number): State {
    return { anchors: Object.fromEntries(Object.entries(state.anchors).map(([id,r])=>[id,mapRange(r,start,end,length)])),
      applied: state.applied.map(r=>mapRange(r,start,end,length)), manual: state.manual.map(r=>mapRange(r,start,end,length)) };
  }
  function edit(text: string) {
    const change=changedRange(value,text);
    const next=remap(change.start,change.end,change.text.length); next.manual.push({start:change.start,end:change.start+change.text.length}); save(next,text); setNotice("");
  }
  async function apply(index: number) {
    if(!finding || !anchor) return;
    setSaving(true);
    try {
      const proposal=finding.proposals![index]; const change=prepareEdit(value,proposal,anchor);
      const text=spliceEdit(value,change); const next=remap(change.start,change.end,change.text.length);
      await onEditDecision(finding.id,{action:"APPLY",content:value,resultContent:text,proposalIndex:index,start:anchor.start,end:anchor.end});
      next.applied.push({id:finding.id,start:change.start,end:change.start+change.text.length,before:value.slice(change.start,change.end),after:change.text,restoreOffset:anchor.start-change.start,restoreLength:proposal.before.length,proposalIndex:index});
      next.anchors[finding.id]={...anchor,stale:true}; save(next,text);
      setNotice(proposal.needsInput ? "템플릿을 적용했습니다. 주황색 입력 항목을 채워주세요." : "선택한 위치에 적용했습니다. 현재 본문으로 다시 검토해주세요.");
      editor.current?.focusRange(change.start,change.start+change.text.length);
    } catch(cause) { setNotice(cause instanceof Error?cause.message:"적용하지 못했습니다."); } finally {setSaving(false);}
  }
  async function undo() {
    if(!applied || applied.stale || value.slice(applied.start,applied.end)!==applied.after) {
      setNotice("적용 이후 해당 문장을 직접 수정했습니다. 수정한 내용이 보존되도록 본문에서 직접 되돌려주세요."); return;
    }
    const change={start:applied.start,end:applied.end,text:applied.before};
    const next=remap(change.start,change.end,change.text.length); next.applied=next.applied.filter(a=>a.id!==applied.id);
    // Other proposals touched by this edit remain stale until reviewed again.
    next.anchors[applied.id]={start:applied.start+applied.restoreOffset,end:applied.start+applied.restoreOffset+applied.restoreLength};
    setSaving(true);
    try {
      const text=spliceEdit(value,change);
      await onEditDecision(applied.id,{action:"UNDO",content:value,resultContent:text,proposalIndex:applied.proposalIndex,start:applied.start,end:applied.end});
      save(next,text); setNotice("선택한 적용을 되돌렸습니다.");
    } catch(e) {setNotice(e instanceof Error?e.message:"되돌리지 못했습니다.");} finally {setSaving(false);}
  }
  async function keep() { if(!finding) return; setSaving(true); try { await onKeep(finding); setNotice("원문 유지 결정을 기록했습니다. 필수 확인 항목은 확정 시 고객 결정 근거가 필요합니다."); } catch(e) { setNotice(e instanceof Error?e.message:"결정을 저장하지 못했습니다."); } finally {setSaving(false);} }
  const slots=placeholders(value);
  return <section className="requirement-compare" aria-label="요구사항 좌우 비교">
    <div className="compare-toolbar"><div><b>원문과 확정될 본문 비교</b><span>제안을 선택한 뒤 적용하거나 원문을 유지하세요.</span></div><div className="compare-legend"><span>파랑: 적용·수정</span><span>주황: 입력 필요 {slots.length}곳</span></div></div>
    <div className="compare-columns">
      <section className="compare-source"><div className="compare-pane-heading"><b>검토 기준 본문</b><small>읽기 전용 · 이번 분석 당시 내용</small></div><pre><MarkedReviewText value={baseline} ranges={finding && finding.spanStart!=null && finding.spanEnd!=null ? [{start:finding.spanStart,end:finding.spanEnd}]:[]} /></pre></section>
      <div className="compare-transfer"><div><button className="btn sm" onClick={()=>detail.current?.scrollIntoView({block:"center",behavior:"smooth"})}>제안<br/>선택 ↓</button>{applied?<button className="btn sm" disabled={disabled||saving} onClick={undo}>← 되돌리기</button>:<button className="btn prim sm" disabled={disabled||saving||!finding?.proposals?.length||anchor?.stale||finding?.resolutionState==="KEPT"} onClick={()=>apply(0)}>적용 →</button>}</div></div>
      <section className="compare-result"><div className="compare-pane-heading"><b>확정될 본문</b><small>직접 수정 가능 · 변경 후 다시 검토</small></div><ReviewTextEditor label="비교 화면의 확정될 본문" ref={editor} value={value} disabled={disabled||saving} onChange={edit} ranges={[...state.applied,...state.manual]} /></section>
    </div>
    {slots.length>0 && <div className="compare-inputs"><b>입력할 위치</b>{slots.map(s=><button key={s.start} className="btn sm" onClick={()=>editor.current?.focusRange(s.start,s.end)}>{s.label}</button>)}</div>}
    <div className="compare-proposals" ref={detail}>
      <nav aria-label="검토 제안 목록">{findings.map((f,index)=><button key={f.id} className={finding?.id===f.id?"on":""} onClick={()=>{setSelected(f.id);setNotice("");}}><span>{String(index+1).padStart(2,"0")}</span><b>{f.findingType}</b><small>{state.applied.some(a=>a.id===f.id)?"적용됨":f.resolutionState==="KEPT"?"원문 유지":f.severity==="BLOCKING"?"필수 확인":"확인 권장"}</small></button>)}{!findings.length && <p>현재 검토에서 발견된 항목이 없습니다.</p>}</nav>
      {finding && <article><div className="proposal-title"><span className={finding.severity==="BLOCKING"?"required":""}>{finding.severity==="BLOCKING"?"필수 확인":"확인 권장"}</span><h3>{finding.findingType}</h3></div><blockquote>{finding.targetSpan}</blockquote><p>{finding.reason}</p>{finding.interpretations && <p className="proposal-interpretation">{finding.interpretations}</p>}{finding.conflictReqKey && <div className="proposal-conflict"><b>기존 요구사항 {finding.conflictReqKey}</b><p>{finding.conflictQuote || "관련 문서의 적용 조건을 확인해주세요."}</p></div>}<p>{finding.suggestion}</p>
        {finding.proposals?.map((p,index)=><div className="proposal-option" key={index}><div><b>{p.label}</b><small>{p.operation==="DELETE"?"선택 구절 삭제":p.operation.startsWith("INSERT")?"기준 문장을 유지하고 추가":"선택 문장만 교체"}{p.needsInput?" · 입력 필요":""}</small></div><pre>{p.operation==="DELETE"?"(해당 구절 삭제)":p.after}</pre><button className="btn prim sm" disabled={disabled||saving||!!applied||anchor?.stale||finding.resolutionState==="KEPT"} onClick={()=>apply(index)}>{p.operation==="DELETE"?"삭제 적용":p.needsInput?"템플릿 적용":"이 제안 적용 →"}</button></div>)}
        {!finding.proposals?.length && <p className="lmsg">바로 적용할 수정문이 없습니다. 설명을 참고해 오른쪽 본문을 직접 수정해주세요.</p>}
        {anchor?.stale && !applied && <p className="lmsg err">대상 문장이 바뀌었습니다. 재검토 후 적용해주세요.</p>}
        <div className="proposal-actions"><button className="btn sm" onClick={()=>document.querySelector(".compare-source .review-changed")?.scrollIntoView({block:"center",behavior:"smooth"})}>원문 위치 보기</button>{anchor&&!anchor.stale&&<button className="btn sm" onClick={()=>editor.current?.focusRange(anchor.start,anchor.end)}>수정 위치 보기</button>}{applied&&<button className="btn" disabled={disabled||saving} onClick={undo}>이 적용 되돌리기</button>}<button className="btn" disabled={disabled||saving||value!==baseline||!!applied||finding.resolutionState==="KEPT"} onClick={keep}>{saving?"기록 중…":finding.resolutionState==="KEPT"?"원문 유지 기록됨":"원문 유지"}</button><small>본문을 수정했다면 재검토 후 원문 유지를 기록할 수 있습니다.</small></div>
      </article>}
    </div>
    {notice&&<p className="compare-notice" role="status">{notice}</p>}
  </section>;
}
