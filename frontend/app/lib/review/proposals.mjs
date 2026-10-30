/** Compose selected edits against immutable UTF-16 source positions. Never match the first repeated phrase. */
export function composeProposals(baseline, findings, choices) {
  const edits=[], pending=[];
  for(const f of findings){
    const d=choices[f.id];if(!d){pending.push(f.id);continue;}
    if(d.action==='EXCLUDE')continue;
    const start=f.spanStart,end=f.spanEnd;
    if(start==null||end==null||start<0||end<start||end>baseline.length||baseline.slice(start,end)!==f.targetSpan)
      return {content:baseline,pending,error:'검토 원문의 위치가 바뀌었습니다. 다시 분석해주세요.',ranges:[]};
    if(d.action==='EDIT'){
      if(!d.replacement?.trim()){pending.push(f.id);continue;}
      edits.push({id:f.id,start,end,text:d.replacement,kind:'manual'});continue;
    }
    const p=f.proposals?.[d.proposalIndex??0];
    if(!p){pending.push(f.id);continue;}
    if(p.operation==='INSERT_BEFORE')edits.push({id:f.id,start,end:start,text:p.after+'\n',kind:'ai'});
    else if(p.operation==='INSERT_AFTER')edits.push({id:f.id,start:end,end,text:'\n'+p.after,kind:'ai'});
    else edits.push({id:f.id,start,end,text:p.operation==='DELETE'?'':p.after,kind:'ai'});
  }
  edits.sort((a,b)=>a.start-b.start||a.end-b.end);
  let cursor=0,content='';
  const positions=new Map();
  for(const e of edits){
    if(e.start<cursor)return {content:baseline,pending,error:'수정안 범위가 겹칩니다. 겹친 항목 중 하나를 원문 유지로 선택한 뒤, 한 항목에서 수정 내용을 함께 반영해주세요.',ranges:[]};
    content+=baseline.slice(cursor,e.start);
    positions.set(e.id,{start:content.length,end:content.length+e.text.length,kind:e.kind});
    content+=e.text;cursor=e.end;
  }
  function translate(point, endBoundary=false) {
    let delta=0;
    for(const e of edits){
      if(point<e.start || (point===e.start && endBoundary))break;
      if(point<e.end)return positions.get(e.id)[endBoundary?'end':'start'];
      delta+=e.text.length-(e.end-e.start);
    }
    return point+delta;
  }
  const ranges=findings.filter(f=>f.spanStart!=null&&f.spanEnd!=null&&baseline.slice(f.spanStart,f.spanEnd)===f.targetSpan).map(f=>{
    const position=positions.get(f.id);
    return {id:f.id,...(position??{start:translate(f.spanStart),end:translate(f.spanEnd,true),kind:choices[f.id]?.action==='EXCLUDE'?'kept':'pending'})};
  });
  return {content:content+baseline.slice(cursor),pending,error:null,ranges};
}
