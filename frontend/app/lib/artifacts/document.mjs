/** Read both saved artifact schemas without exposing transport metadata as fields. */
export const ARTIFACT_TYPES=[
 {type:'voc',label:'SWVOC',short:'VOC',description:'고객 요청과 전달 사항'},
 {type:'functional',label:'기능 요구사항',short:'FR',description:'기본·변형·예외 동작 정의'},
 {type:'nonfunctional',label:'비기능 요구사항',short:'NFR',description:'품질 기준과 동작 정의'},
 {type:'detail-design',label:'상세 설계',short:'DD',description:'구조와 변경 전·후 처리 흐름'},
];
export function cleanDiagram(value){
 if(typeof value!=='string')return '';
 let code=value.trim();
 // Some saved AI responses contain literal backslash-n characters instead of
 // line breaks. Repair those documents on read, without altering stored data or
 // Mermaid labels in documents that already contain real line breaks.
 if(!code.includes('\n')&&/\\(?:r\\)?n/.test(code))code=code.replace(/\\r\\n|\\n|\\r/g,'\n');
 return code.replace(/^```(?:mermaid)?\s*\n?/i,'').replace(/\n?```\s*$/,'').trim();
}
export function classDiagramSource(value){
 if(typeof value==='string')return cleanDiagram(value);
 if(!Array.isArray(value))return '';
 const rows=value.filter(row=>row&&typeof row==='object'&&typeof row.name==='string');
 if(!rows.length)return '';
 const safe=v=>String(v).replace(/[\r\n{};]/g,' ').replace(/"/g,"'");
 return 'classDiagram\n'+rows.map((row,i)=>`    class Class_${i}["${safe(row.name)}"] {\n${(Array.isArray(row.fields)?row.fields:[]).map(field=>'      '+safe(field)).join('\n')}\n    }`).join('\n');
}
const scenarioLabels={BASIC:'기본 시나리오',VARIANT:'대안 시나리오',EXCEPTION:'예외 시나리오','기본':'기본 시나리오','대안':'대안 시나리오','예외':'예외 시나리오'};
export function scenariosFor(content){
 if(Array.isArray(content.scenarios))return content.scenarios.filter(row=>row&&typeof row==='object').map((row,i)=>({...row,label:scenarioLabels[row.type]??`시나리오 ${i+1}`}));
 const groups=new Map();
 for(const row of Array.isArray(content.behaviors)?content.behaviors:[]){
  if(!row||typeof row!=='object')continue;
  const type=row.type??'기본',group=groups.get(type)??{type,label:scenarioLabels[type]??String(type)};
  const field={'선행조건':'precondition','시나리오':'scenario','후행조건':'postcondition'}[row.item];
  if(field)group[field]=[group[field],row.content].filter(Boolean).join('\n');
  else group.scenario=[group.scenario,row.content].filter(Boolean).join('\n');
  groups.set(type,group);
 }
 return [...groups.values()];
}
export function designDiagrams(content){return {
 classes:classDiagramSource(documentValue(content,'classDiagram')),
 before:cleanDiagram(documentValue(content,'sequenceDiagramAsIs',['sequenceBeforeCode'])),
 after:cleanDiagram(documentValue(content,'sequenceDiagramToBe',['sequenceAfterCode'])),
};}

// Stable document contracts: do not let JSON property order or transport metadata
// determine the business form. Legacy values can live under a v2 empty shell.
export const DOCUMENT_FIELDS={
 issue:[['symptom','현상'],['improvementReq','개선 요구'],['changeScope','변경 범위'],['constraintsNote','제약 조건'],['beforeState','변경 전'],['afterState','변경 후']],
 voc:[['requester','요청자'],['requestContent','고객 요청 내용'],['specialNotes','특이 사항']],
 functional:[['overview','요구사항 개요'],['constraintsNote','제약 조건']],
 nonfunctional:[['overview','요구사항 개요'],['constraintsNote','제약 조건']],
 'detail-design':[['description','설계 개요']],
};
const aliases={overview:['description'],requestContent:['request'],specialNotes:['notes'],constraintsNote:['constraints']};
export const BUSINESS_LABELS={title:'제목',summary:'요약',description:'개요',content:'내용',role:'수행 역할',purpose:'목적',scope:'적용 범위',requirements:'요구사항',acceptanceCriteria:'완료 기준',preconditions:'선행 조건',postconditions:'후행 조건',steps:'수행 절차',exceptions:'예외 처리',constraints:'제약 조건',name:'이름',definition:'정의',type:'유형',item:'항목',value:'값',reason:'근거',quote:'원문',reqKey:'요구사항',field:'항목',request:'고객 요청 내용',notes:'특이 사항',requester:'요청자',requestContent:'고객 요청 내용',specialNotes:'특이 사항',overview:'요구사항 개요',constraintsNote:'제약 조건',functionalRequirements:'기능 요구사항',nonFunctionalRequirements:'비기능 요구사항'};
export const hasDocumentValue=value=>value!==null&&value!==undefined&&(typeof value!=='string'||value.trim()!=='')&&(!Array.isArray(value)||value.length>0);
export function documentValue(content,key,alternate=aliases[key]??[]){
 const legacy=content.legacyExtras&&typeof content.legacyExtras==='object'&&!Array.isArray(content.legacyExtras)?content.legacyExtras:{};
 for(const source of [content,legacy])for(const name of [key,...alternate])if(hasDocumentValue(source[name]))return source[name];
 return null;
}
export function documentSections(type,content){return (DOCUMENT_FIELDS[type]??[]).map(([key,label])=>({key,label,value:documentValue(content,key)}));}
export function documentScenarios(content){
 const direct=scenariosFor(content);
 const legacy=content.legacyExtras&&typeof content.legacyExtras==='object'?scenariosFor(content.legacyExtras):[];
 const canonical={BASIC:'BASIC',VARIANT:'VARIANT',EXCEPTION:'EXCEPTION','기본':'BASIC','변형':'VARIANT','대안':'VARIANT','예외':'EXCEPTION'};
 const labels={BASIC:'기본 동작',VARIANT:'변형 동작',EXCEPTION:'예외 동작'};
 return Object.entries(labels).map(([type,label])=>{
  const current=direct.find(item=>canonical[item.type]===type);
  const previous=legacy.find(item=>canonical[item.type]===type);
  const row=current??previous;
  if(!row)return {type,label,precondition:null,scenario:null,postcondition:null,applicability:'UNKNOWN',reason:null};
  const merged={...row,type,label};
  if(current&&previous&&current.applicability!=='NOT_APPLICABLE')for(const field of ['precondition','scenario','postcondition'])if(!hasDocumentValue(current[field]))merged[field]=previous[field]??null;
  return merged;
 });
}
export function supplementalFields(type,content){
 const used=new Set((DOCUMENT_FIELDS[type]??[]).flatMap(([key])=>[key,...(aliases[key]??[])]));
 return Object.entries(BUSINESS_LABELS).filter(([key])=>!used.has(key)&&hasDocumentValue(documentValue(content,key,[]))).map(([key,label])=>({key,label,value:documentValue(content,key,[])}));
}
