/** Compose selected edits against immutable UTF-16 source positions. Never match the first repeated phrase. */
export function composeProposals(baseline, findings, choices) {
  const edits=[], pending=[];
  for(const f of findings){
    const d=choices[f.id];if(!d){pending.push(f.id);continue;}
    if(d.action==='EXCLUDE')continue;
    const start=f.spanStart,end=f.spanEnd;
    if(start==null||end==null||start<0||end<start||end>baseline.length||baseline.slice(start,end)!==f.targetSpan)
      return {content:baseline,pending,error:'검토 원문의 위치가 바뀌었습니다. 다시 분석해주세요.'};
    if(d.action==='EDIT'){
      if(!d.replacement?.trim()){pending.push(f.id);continue;}
      edits.push({start,end,text:d.replacement});continue;
    }
    const p=f.proposals?.[d.proposalIndex??0];
    if(!p){pending.push(f.id);continue;}
    if(p.operation==='INSERT_BEFORE')edits.push({start,end:start,text:p.after+'\n'});
    else if(p.operation==='INSERT_AFTER')edits.push({start:end,end,text:'\n'+p.after});
    else edits.push({start,end,text:p.operation==='DELETE'?'':p.after});
  }
  edits.sort((a,b)=>a.start-b.start||a.end-b.end);
  let cursor=0,content='';
  for(const e of edits){
    if(e.start<cursor)return {content:baseline,pending,error:'수정안 범위가 겹칩니다. 최종 본문 직접 수정에서 내용을 정리해주세요.'};
    content+=baseline.slice(cursor,e.start)+e.text;cursor=e.end;
  }
  return {content:content+baseline.slice(cursor),pending,error:null};
}
